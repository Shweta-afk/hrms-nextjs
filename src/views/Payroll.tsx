'use client'

import { buildPayslipHtml } from "@/lib/payslip-html";
import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertTriangle, CircleAlert,
  FileSpreadsheet, FileText, CheckCircle2, Loader2, Play, Settings2, Clock,
  Upload, ArrowLeftRight, Download, Pencil, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import EditPayslipModal from "@/components/payroll/EditPayslipModal";

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

interface Payslip {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  working_days: number;
  present_days: number;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  is_published: boolean;
  // Set when this specific payslip has been HR-approved. Drives the per-row
  // status badge and the "already approved → checkbox disabled" rule.
  hr_approved_at: string | null;
  is_manually_adjusted: boolean;
  original_earnings: Record<string, number> | null;
  original_deductions: Record<string, number> | null;
  original_net_salary: number | null;
  adjustment_note: string | null;
  employee: {
    first_name: string;
    last_name: string;
    emp_code: string;
    date_of_joining: string | null;
    bank_details: { bank_name?: string; account_number?: string; ifsc_code?: string; branch?: string } | null;
    bank_details_decrypted?: { bank_name?: string; account_number?: string; ifsc_code?: string; branch?: string } | null;
    statutory_info_decrypted?: { pan_number?: string; uan_number?: string; pf_number?: string; aadhar_number?: string } | null;
    department: { name: string } | null;
    designation: { name: string } | null;
  };
}

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  payslips: { id: string }[];
}

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const Payroll = () => {
  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const [run, setRun] = useState<PayrollRun | null>(null)
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [approveModal, setApproveModal] = useState(false)
  const [approving, setApproving] = useState(false)
  const [showAnomalies, setShowAnomalies] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Per-payslip line-item editor — opened from the Edit button in the
  // payslip table. State lifted here (not into the modal) so closing the
  // dialog cleanly resets to "no payslip", and so we can also re-fetch
  // payroll data on save without prop-drilling.
  const [editPayslip, setEditPayslip] = useState<Payslip | null>(null)
  const [editOpen,    setEditOpen]    = useState(false)

  // Selection for partial approval. Tracks IDs the user has ticked.
  // Already-approved payslips are deliberately NOT pre-selected — the
  // approve action is no-op on them, but selecting them would inflate
  // the "N selected" badge and confuse HR about what they're approving.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Modal mode: 'all' = legacy "Approve Payroll" (entire run), 'selected'
  // = approve just the ticked subset. Keeps one modal component, two
  // confirmations.
  const [approveScope, setApproveScope] = useState<'all' | 'selected'>('all')
  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const [otRate, setOtRate] = useState(0)
  const [showOtSettings, setShowOtSettings] = useState(false)
  const [orgInfo, setOrgInfo] = useState<{
    name: string; logo_url?: string; address?: string;
    gst_number?: string; tan_number?: string; website?: string; phone?: string;
  }>({ name: '' })
  const [runWarnings, setRunWarnings] = useState<{
    warnings: string[];
    zero_attendance_employees: Array<{ id: string; first_name: string; emp_code?: string | null }>;
  }>({ warnings: [], zero_attendance_employees: [] })

  // Custom salary period
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')

  // Adjustment workflow
  const [adjModal, setAdjModal] = useState(false)
  const [adjFile, setAdjFile] = useState<File | null>(null)
  const [adjUploading, setAdjUploading] = useState(false)
  const [adjResult, setAdjResult] = useState<{
    adjusted: number; unchanged: number; not_found: number;
    diffs: Array<{ emp_code: string; name: string; original_net: number; adjusted_net: number }>
    skipped?: Array<{ row: number; emp_code: string; reason: string }>
  } | null>(null)

  const currentMonth = ((now.getMonth() + monthOffset) % 12) + 1
  const currentYear = now.getFullYear() + Math.floor((now.getMonth() + monthOffset) / 12)
  const monthLabel = `${monthNames[currentMonth - 1]} ${currentYear}`

  async function fetchPayrollData() {
    setLoading(true)
    // Clear any partial-approval selection on every refetch — keeps the
    // "N selected" badge in sync with the visible payslips (e.g. when HR
    // navigates to a different month, or after the table is reloaded
    // post-approve).
    setSelectedIds(new Set())
    try {
      const runsRes = await fetch('/api/payroll/runs')
      const runsJson = await runsRes.json()
      if (runsJson.success) {
        const currentRun = runsJson.data.find(
          (r: PayrollRun) => r.month === currentMonth && r.year === currentYear
        )
        setRun(currentRun || null)
        if (currentRun) {
          const slipsRes = await fetch(`/api/payroll/payslips?payroll_run_id=${currentRun.id}`)
          const slipsJson = await slipsRes.json()
          if (slipsJson.success) setPayslips(slipsJson.data)
          else setPayslips([])
        } else {
          setPayslips([])
        }
      }
    } catch {
      toast.error('Failed to load payroll data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPayrollData() }, [monthOffset])

  useEffect(() => {
    fetch('/api/org/settings').then(r => r.json()).then(j => {
      if (j.success) {
        const s = j.data as Record<string, unknown>
        setOrgInfo({
          name:        (s.company_name as string) || '',
          logo_url:    s.logo_url    as string | undefined,
          address:     s.address     as string | undefined,
          gst_number:  s.gst_number  as string | undefined,
          tan_number:  s.tan_number  as string | undefined,
          website:     s.website     as string | undefined,
          phone:       s.phone       as string | undefined,
        })
      }
    }).catch(() => {})
    // Also pull org name from session via existing runs API
    fetch('/api/payroll/runs').then(r => r.json()).catch(() => {})
  }, [])

  async function handleRecalculate() {
    if (!run) return
    if (!confirm('This will recalculate all payslips for this month using current CTC and settings. Any manual adjustments will be lost. Continue?')) return
    setRunning(true)
    try {
      // Unapprove the run first if it's approved
      if (isApproved) {
        await fetch(`/api/payroll/runs/${run.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'draft' }),
        })
      }
      const res = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payroll_run_id: run.id,
          ot_rate_per_hour: otRate,
          ...(periodFrom && { period_from: periodFrom }),
          ...(periodTo   && { period_to:   periodTo }),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Recalculated — ${json.data.employees_processed} employees`)
        fetchPayrollData()
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Failed to recalculate payroll')
    } finally {
      setRunning(false)
    }
  }

  async function handleRunPayroll() {
    setRunning(true)
    try {
      let runId = run?.id
      if (!run) {
        const res = await fetch('/api/payroll/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: currentMonth, year: currentYear }),
        })
        const json = await res.json()
        if (!json.success) { toast.error(json.error); return }
        runId = json.data.id
      }
      const res = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payroll_run_id: runId,
          ot_rate_per_hour: otRate,
          ...(periodFrom && { period_from: periodFrom }),
          ...(periodTo   && { period_to:   periodTo }),
        }),
      })
      const json = await res.json()
      if (json.success) {
        const warnings: string[] = json.data.warnings ?? []
        const zero: Array<{ id: string; first_name: string; emp_code?: string | null }> =
          json.data.zero_attendance_employees ?? []
        setRunWarnings({ warnings, zero_attendance_employees: zero })
        if (zero.length > 0) {
          toast.warning(`Payroll processed — but ${zero.length} employee${zero.length === 1 ? '' : 's'} had no attendance this month. Review before approving.`)
        } else {
          toast.success(`Payroll processed — ${json.data.employees_processed} employees`)
        }
        fetchPayrollData()
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Failed to run payroll')
    } finally {
      setRunning(false)
    }
  }

  async function handleApprove() {
    if (!run) return
    setApproving(true)
    try {
      // Two routes share this handler:
      //   - 'selected' → bulk-approve the ticked subset (leaves the rest in Draft)
      //   - 'all'      → legacy whole-run approve (also flips run.status to 'approved')
      const isSelected = approveScope === 'selected'
      const res = isSelected
        ? await fetch('/api/payroll/payslips/bulk-approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payslip_ids: Array.from(selectedIds) }),
          })
        : await fetch(`/api/payroll/runs/${run.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' }),
          })
      const json = await res.json()
      if (json.success) {
        if (isSelected) {
          const n = json.data?.approved ?? selectedIds.size
          toast.success(
            json.data?.run_finalized
              ? `${n} payslip${n === 1 ? '' : 's'} approved — entire run is now finalized`
              : `${n} payslip${n === 1 ? '' : 's'} approved — employees will receive their payslips by email`
          )
          setSelectedIds(new Set())
        } else {
          toast.success('Payroll approved — payslips published to employees')
        }
        setApproveModal(false)
        fetchPayrollData()
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Failed to approve payroll')
    } finally {
      setApproving(false)
    }
  }

  async function handleExportForReview() {
    if (!run) return
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}/export`)
      if (!res.ok) { toast.error('Export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `payroll-${monthLabel.replace(' ', '-')}-review.xlsx`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Exported — edit the file and upload adjustments when done')
    } catch {
      toast.error('Export failed')
    }
  }

  async function handleImportAdjustments() {
    if (!run || !adjFile) return
    setAdjUploading(true)
    try {
      const form = new FormData()
      form.append('file', adjFile)
      const res = await fetch(`/api/payroll/runs/${run.id}/import-adjustments`, {
        method: 'POST',
        body: form,
      })
      const json = await res.json()
      if (json.success) {
        setAdjResult(json.data)
        toast.success(`Adjustments applied — ${json.data.adjusted} payslip${json.data.adjusted !== 1 ? 's' : ''} updated`)
        fetchPayrollData()
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setAdjUploading(false)
    }
  }

  function handleViewPayslip(payslipId: string) {
    const payslip = payslips.find(p => p.id === payslipId)
    if (!payslip) return

    const emp  = payslip.employee
    const bank = emp.bank_details_decrypted ?? emp.bank_details
    const statutory = emp.statutory_info_decrypted

    const html = buildPayslipHtml(
      {
        month:        payslip.month,
        year:         payslip.year,
        working_days: payslip.working_days,
        present_days: payslip.present_days,
        earnings:     payslip.earnings  as Record<string, number>,
        deductions:   payslip.deductions as Record<string, number>,
        net_salary:   Number(payslip.net_salary),
        employee: {
          emp_code:        emp.emp_code,
          first_name:      emp.first_name,
          last_name:       emp.last_name,
          date_of_joining: emp.date_of_joining,
          department:      emp.department  ?? undefined,
          designation:     emp.designation ?? undefined,
        },
        statutory:            statutory                    ?? undefined,
        bank:                 bank                         ?? undefined,
        is_manually_adjusted: payslip.is_manually_adjusted ?? false,
        original_deductions:  payslip.original_deductions  as Record<string, number> | null ?? null,
      },
      orgInfo,
      { isDraft: !isApproved }
    )

    const win = window.open('', '_blank')
    if (!win) { toast.error('Please allow popups'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
  }

  function handleExportExcel() {
    if (payslips.length === 0) { toast.error('No payslips to export'); return }
    const headers = ['Employee','Code','Department','Basic','HRA','Special Allowance','OT Pay','Gross','PF','ESI','PT','TDS','LOP','Net Pay']
    const rows = payslips.map(p => {
      const otK = Object.keys(p.earnings).find(k => k.startsWith('Overtime Pay'))
      return [
        `${p.employee.first_name} ${p.employee.last_name}`,
        p.employee.emp_code,
        p.employee.department?.name ?? '',
        p.earnings['Basic'] ?? 0,
        p.earnings['HRA'] ?? 0,
        p.earnings['Special Allowance'] ?? 0,
        otK ? (p.earnings[otK] ?? 0) : 0,
        p.gross_salary,
        p.deductions['PF Employee'] ?? 0,
        p.deductions['ESI Employee'] ?? 0,
        p.deductions['Professional Tax'] ?? 0,
        p.deductions['TDS'] ?? 0,
        p.deductions['Loss of Pay'] ?? 0,
        p.net_salary,
      ]
    })
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payroll-${monthLabel.replace(' ', '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Payroll register exported')
  }

  function handleDownloadPDF() {
    if (payslips.length === 0) { toast.error('No payslips to download'); return }
    const co2 = orgInfo
    const printContent = `<!DOCTYPE html><html><head><title>Payroll Register — ${monthLabel}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h1{font-size:18px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e1b4b;color:#fff;padding:8px 6px;text-align:right;font-size:11px}th:first-child{text-align:left}td{padding:7px 6px;border-bottom:1px solid #eee;text-align:right;font-size:11px}td:first-child{text-align:left;font-weight:500}.net{color:#16a34a;font-weight:700}tfoot td{font-weight:700;border-top:2px solid #1e1b4b;background:#f8f9ff}</style>
    </head><body>
    ${co2.logo_url ? `<img src="${co2.logo_url}" style="height:48px;width:auto;object-fit:contain;margin-bottom:4px;display:block" />` : ''}
    <h1>${co2.name || 'Company'} — Payroll Register — ${monthLabel}</h1>
    <p>Generated: ${new Date().toLocaleDateString('en-IN')} | Employees: ${payslips.length} | Status: ${run?.status?.toUpperCase()}</p>
    <table><thead><tr><th>Employee</th><th>Basic</th><th>HRA</th><th>Special</th><th>Gross</th><th>PF</th><th>ESI</th><th>PT</th><th>TDS</th><th>Net Pay</th></tr></thead>
    <tbody>${payslips.map(p => `<tr>
      <td>${p.employee.first_name} ${p.employee.last_name} (${p.employee.emp_code})</td>
      <td>${fmt(p.earnings['Basic'] ?? 0)}</td><td>${fmt(p.earnings['HRA'] ?? 0)}</td>
      <td>${fmt(p.earnings['Special Allowance'] ?? 0)}</td><td><strong>${fmt(p.gross_salary)}</strong></td>
      <td>${p.deductions['PF Employee'] ? fmt(p.deductions['PF Employee']) : '—'}</td>
      <td>${p.deductions['ESI Employee'] ? fmt(p.deductions['ESI Employee']) : '—'}</td>
      <td>${p.deductions['Professional Tax'] ? fmt(p.deductions['Professional Tax']) : '—'}</td>
      <td>${p.deductions['TDS'] ? fmt(p.deductions['TDS']) : '—'}</td>
      <td class="net">${fmt(p.net_salary)}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td>TOTAL (${payslips.length})</td>
      <td>${fmt(payslips.reduce((s,p)=>s+(p.earnings['Basic']??0),0))}</td>
      <td>${fmt(payslips.reduce((s,p)=>s+(p.earnings['HRA']??0),0))}</td>
      <td>${fmt(payslips.reduce((s,p)=>s+(p.earnings['Special Allowance']??0),0))}</td>
      <td>${fmt(Number(run?.total_gross??0))}</td>
      <td>${fmt(payslips.reduce((s,p)=>s+(p.deductions['PF Employee']??0),0))}</td>
      <td>${fmt(payslips.reduce((s,p)=>s+(p.deductions['ESI Employee']??0),0))}</td>
      <td>${fmt(payslips.reduce((s,p)=>s+(p.deductions['Professional Tax']??0),0))}</td>
      <td>${fmt(payslips.reduce((s,p)=>s+(p.deductions['TDS']??0),0))}</td>
      <td class="net">${fmt(Number(run?.total_net??0))}</td></tr></tfoot>
    </table></body></html>`
    const win = window.open('', '_blank')
    if (!win) { toast.error('Please allow popups'); return }
    win.document.write(printContent)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
    toast.success('Opening payroll register for download')
  }

  const isApproved = run?.status === 'approved'

  // Per-payslip approval bookkeeping. Used by the selection UI, the per-row
  // status badge, and the action bar.
  const unapprovedPayslips = payslips.filter(p => !p.hr_approved_at)
  const approvedCount      = payslips.length - unapprovedPayslips.length
  const allApproved        = payslips.length > 0 && unapprovedPayslips.length === 0
  // Only consider currently-unapproved payslips when evaluating "is everything
  // ticked?" — already-approved rows are intentionally non-selectable.
  const allUnapprovedTicked = unapprovedPayslips.length > 0 &&
    unapprovedPayslips.every(p => selectedIds.has(p.id))
  const selectedNetTotal = payslips
    .filter(p => selectedIds.has(p.id))
    .reduce((sum, p) => sum + Number(p.net_salary), 0)

  return (
    <AppLayout title="Payroll">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthOffset(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-28 text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthOffset(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {/* Salary period date range */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Period:</span>
            <input
              type="date"
              value={periodFrom}
              onChange={e => setPeriodFrom(e.target.value)}
              className="h-9 text-xs border border-input bg-background text-foreground rounded-md px-2 w-32"
              title="Salary period start (leave blank for 1st of month)"
            />
            <span>–</span>
            <input
              type="date"
              value={periodTo}
              onChange={e => setPeriodTo(e.target.value)}
              className="h-9 text-xs border border-input bg-background text-foreground rounded-md px-2 w-32"
              title="Salary period end (leave blank for last of month)"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setShowOtSettings(v => !v)}
            title="Overtime Settings"
          >
            <Settings2 className="h-4 w-4 mr-1.5" />
            OT {otRate > 0 ? `₹${otRate}/hr` : 'Settings'}
          </Button>
          <Button className="h-9 font-semibold" onClick={handleRunPayroll} disabled={running || isApproved}>
            {running
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              : <><Play className="h-4 w-4 mr-2" />Run Payroll</>
            }
          </Button>
          {run && (
            <Button variant="outline" className="h-9" onClick={handleRecalculate} disabled={running} title="Recalculate all payslips from current CTC and settings">
              {running
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><RefreshCw className="h-4 w-4 mr-1.5" />Recalculate</>
              }
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {!loading && !run && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 mb-5">
          <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">
            No payroll run for <span className="font-semibold">{monthLabel}</span>. Click "Run Payroll" to start.
          </span>
        </div>
      )}
      {!loading && run && !isApproved && (
        <div className="flex items-center gap-3 rounded-lg border border-kpi-amber/30 bg-kpi-amber/8 px-4 py-3 mb-5">
          <AlertTriangle className="h-4 w-4 text-kpi-amber shrink-0" />
          <span className="flex-1 text-sm text-foreground">
            Payroll for <span className="font-semibold">{monthLabel}</span> is in{' '}
            <Badge variant="notice" className="mx-1 text-[10px]">DRAFT</Badge>. Review and approve.
          </span>
        </div>
      )}
      {!loading && isApproved && (
        <div className="flex items-center gap-3 rounded-lg border border-kpi-green/30 bg-kpi-green/8 px-4 py-3 mb-5">
          <CheckCircle2 className="h-4 w-4 text-kpi-green shrink-0" />
          <span className="text-sm text-foreground">
            Payroll for <span className="font-semibold">{monthLabel}</span> has been{' '}
            <Badge variant="active" className="mx-1 text-[10px]">APPROVED</Badge>. Payslips are visible to employees.
          </span>
        </div>
      )}

      {/* OT Settings */}
      {showOtSettings && (
        <Card className="mb-5 border-kpi-amber/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-kpi-amber" /> Overtime Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">OT Rate (₹ per hour)</Label>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={otRate}
                  onChange={e => setOtRate(Math.max(0, Number(e.target.value)))}
                  className="h-8 w-36 text-sm"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground pb-1 max-w-sm">
                OT hours are pulled from attendance records (imported via Smart Office Monthly Details).
                Set to <strong>0</strong> to skip OT pay. Applied on next "Run Payroll".
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Total Gross Payroll</p>
            <p className="text-2xl font-bold tabular-nums">{run ? fmt(Number(run.total_gross)) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Total Deductions</p>
            <p className="text-2xl font-bold tabular-nums text-destructive">{run ? fmt(Number(run.total_deductions)) : '—'}</p>
          </CardContent>
        </Card>
        <Card className="border-kpi-green/20">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Net Payout</p>
            <p className="text-2xl font-bold tabular-nums text-kpi-green">{run ? fmt(Number(run.total_net)) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Employees Processed</p>
            <p className="text-2xl font-bold tabular-nums">{payslips.length} <span className="text-base font-normal text-muted-foreground">employees</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies */}
      {showAnomalies && payslips.length > 0 && !isApproved && (
        <Card className="border-l-4 border-l-kpi-amber mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CircleAlert className="h-4 w-4 text-kpi-amber" /> Review Before Approving
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground w-16">Info</span>
              <span>{payslips.length} employee(s) included in this payroll run</span>
            </div>

            {/* Zero-attendance warning — surfaced from the run API */}
            {runWarnings.zero_attendance_employees.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-destructive shrink-0 mt-1.5" />
                <span className="text-xs font-medium uppercase tracking-wider text-destructive w-16 mt-0.5">Warn</span>
                <div className="flex-1">
                  <p className="text-foreground">
                    <strong>{runWarnings.zero_attendance_employees.length}</strong> employee{runWarnings.zero_attendance_employees.length === 1 ? '' : 's'} had no attendance records this month — full month marked as Loss of Pay.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Likely a biometric sync issue or attendance not yet imported. Add manual attendance corrections, or import device data, before approving.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {runWarnings.zero_attendance_employees.slice(0, 8).map(e => (
                      <span key={e.id} className="text-[11px] px-2 py-0.5 rounded bg-destructive/10 text-destructive font-mono">
                        {e.emp_code ?? e.first_name}
                      </span>
                    ))}
                    {runWarnings.zero_attendance_employees.length > 8 && (
                      <span className="text-[11px] px-2 py-0.5 text-muted-foreground">
                        +{runWarnings.zero_attendance_employees.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => setShowAnomalies(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Dismiss
            </button>
          </CardContent>
        </Card>
      )}

      {/* Payroll Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Payroll Summary — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : payslips.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {run ? 'Click Run Payroll to process employees.' : 'No payroll run for this month. Click Run Payroll to start.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-9">
                      {/* Header checkbox = select/clear all *unapproved* payslips.
                          We deliberately scope this to unapproved rows: ticking
                          rows that are already approved would inflate the
                          "N selected" count without changing what gets approved. */}
                      {unapprovedPayslips.length > 0 && (
                        <Checkbox
                          checked={allUnapprovedTicked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds(new Set(unapprovedPayslips.map(p => p.id)))
                            } else {
                              setSelectedIds(new Set())
                            }
                          }}
                          aria-label="Select all unapproved payslips"
                        />
                      )}
                    </TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">HRA</TableHead>
                    <TableHead className="text-right">Special</TableHead>
                    <TableHead className="text-right text-kpi-amber">OT Pay</TableHead>
                    <TableHead className="text-right font-semibold">Gross</TableHead>
                    <TableHead className="text-right">PF</TableHead>
                    <TableHead className="text-right">ESI</TableHead>
                    <TableHead className="text-right">PT</TableHead>
                    <TableHead className="text-right">TDS</TableHead>
                    <TableHead className="text-right text-destructive">LOP</TableHead>
                    <TableHead className="text-right font-semibold">Net Pay</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((p) => {
                    const isExpanded = expandedId === p.id
                    const basic = p.earnings['Basic'] ?? 0
                    const hra = p.earnings['HRA'] ?? 0
                    const special = p.earnings['Special Allowance'] ?? 0
                    const otKey = Object.keys(p.earnings).find(k => k.startsWith('Overtime Pay'))
                    const otPay = otKey ? (p.earnings[otKey] ?? 0) : 0
                    const otherEarnings = Object.entries(p.earnings)
                      .filter(([k]) => !['Basic','HRA','Special Allowance'].includes(k) && !k.startsWith('Overtime Pay'))
                    const lopAmt  = p.deductions['Loss of Pay'] ?? 0
                    // working_days stores calendar days (period length); per-day rate = gross / calendar days
                    const dayRate = p.working_days > 0 ? Math.round(p.gross_salary / p.working_days) : 0
                    // Derive lopDays from stored amount rather than recalculating (avoids calendar vs working-days mismatch)
                    const lopDays = dayRate > 0 ? Math.round(lopAmt / dayRate) : 0
                    const ctcMonthly = basic + hra + special
                    return (
                      <>
                        <TableRow
                          key={p.id}
                          className="cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        >
                          {/* Selection checkbox. Disabled (and hidden) for already-
                              approved rows — approval is one-way through this UI;
                              "unapprove" still lives on the individual payslip view. */}
                          <TableCell className="w-9" onClick={e => e.stopPropagation()}>
                            {!p.hr_approved_at && (
                              <Checkbox
                                checked={selectedIds.has(p.id)}
                                onCheckedChange={() => toggleSelected(p.id)}
                                aria-label={`Select payslip for ${p.employee.first_name} ${p.employee.last_name}`}
                              />
                            )}
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isExpanded
                                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              }
                              <div>
                                {p.employee.first_name} {p.employee.last_name}
                                <p className="text-xs text-muted-foreground">{p.employee.emp_code}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(basic)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(hra)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(special)}</TableCell>
                          <TableCell className="text-right tabular-nums text-kpi-amber font-medium">
                            {otPay > 0 ? fmt(otPay) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{fmt(p.gross_salary)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{p.deductions['PF Employee'] ? fmt(p.deductions['PF Employee']) : '—'}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{p.deductions['ESI Employee'] ? fmt(p.deductions['ESI Employee']) : '—'}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{p.deductions['Professional Tax'] ? fmt(p.deductions['Professional Tax']) : '—'}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{p.deductions['TDS'] ? fmt(p.deductions['TDS']) : '—'}</TableCell>
                          <TableCell className="text-right tabular-nums text-destructive font-medium" title={lopDays > 0 ? `${lopDays} day${lopDays !== 1 ? 's' : ''} × ${fmt(dayRate)}/day` : undefined}>
                            {lopAmt > 0 ? `−${fmt(lopAmt)}` : '—'}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums font-semibold ${p.net_salary > 0 ? 'text-kpi-green' : 'text-destructive'}`}>{fmt(p.net_salary)}</TableCell>
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col items-center gap-1">
                              {/* Drive the badge off the per-payslip approval stamp,
                                  not the run status — once partial approval lands,
                                  the run can stay in 'draft' while some rows are
                                  individually approved. */}
                              <Badge variant={p.hr_approved_at ? 'active' : 'secondary'} className="text-[10px]">
                                {p.hr_approved_at ? 'Approved' : 'Draft'}
                              </Badge>
                              {p.is_manually_adjusted && (
                                <Badge variant="notice" className="text-[10px]">Adjusted</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleViewPayslip(p.id)}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                View / Print
                              </button>
                              {/* Edit button — gated visually (not disabled)
                                  when the payslip is already approved, so
                                  HR still sees the affordance and the modal
                                  itself shows the unapprove-first guidance.
                                  Less mystery than a greyed-out button. */}
                              <button
                                onClick={() => { setEditPayslip(p); setEditOpen(true) }}
                                className="text-xs font-medium text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                                title="Edit line items (Basic, HRA, PF, ESI, etc.)"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded breakdown row */}
                        {isExpanded && (
                          <TableRow key={`${p.id}-detail`} className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={14} className="p-0">
                              <div className="px-6 py-4 border-t border-border">
                                {/* Attendance strip */}
                                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4 pb-3 border-b border-border">
                                  <span>Monthly CTC: <strong className="text-foreground">{fmt(ctcMonthly)}</strong></span>
                                  <span>Working days: <strong className="text-foreground">{p.working_days}</strong></span>
                                  <span>Days present: <strong className="text-foreground">{Number(p.present_days)}</strong></span>
                                  {lopDays > 0 && (
                                    <span className="text-destructive font-medium">LOP: {lopDays} day{lopDays !== 1 ? 's' : ''} × {fmt(dayRate)}/day = −{fmt(lopAmt)}</span>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {/* Earnings */}
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Earnings</p>
                                    <div className="space-y-1.5">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                          Basic
                                          <span className="text-xs ml-1 text-muted-foreground/70">
                                            ({ctcMonthly > 0 ? Math.round(basic / ctcMonthly * 100) : 0}% of {fmt(ctcMonthly)})
                                          </span>
                                        </span>
                                        <span className="tabular-nums font-medium">{fmt(basic)}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                          HRA
                                          <span className="text-xs ml-1 text-muted-foreground/70">
                                            ({basic > 0 ? Math.round(hra / basic * 100) : 0}% of basic)
                                          </span>
                                        </span>
                                        <span className="tabular-nums font-medium">{fmt(hra)}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Special Allowance <span className="text-xs text-muted-foreground/70">(remainder)</span></span>
                                        <span className="tabular-nums font-medium">{fmt(special)}</span>
                                      </div>
                                      {otPay > 0 && (
                                        <div className="flex justify-between text-sm text-kpi-amber">
                                          <span>{otKey}</span>
                                          <span className="tabular-nums font-medium">{fmt(otPay)}</span>
                                        </div>
                                      )}
                                      {otherEarnings.map(([k, v]) => (
                                        <div key={k} className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">{k}</span>
                                          <span className="tabular-nums font-medium">{fmt(v)}</span>
                                        </div>
                                      ))}
                                      {lopAmt > 0 && (
                                        <div className="flex justify-between text-sm text-destructive">
                                          <span>Loss of Pay <span className="text-xs">({lopDays}d × {fmt(dayRate)}/day)</span></span>
                                          <span className="tabular-nums font-medium">−{fmt(lopAmt)}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5 mt-1">
                                        <span>Gross Salary</span>
                                        <span className="tabular-nums">{fmt(p.gross_salary)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Deductions */}
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Deductions</p>
                                    <div className="space-y-1.5">
                                      {p.deductions['PF Employee'] > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">
                                            PF (Employee)
                                            <span className="text-xs ml-1 text-muted-foreground/70">(12% of basic {fmt(basic)})</span>
                                          </span>
                                          <span className="tabular-nums font-medium text-destructive">{fmt(p.deductions['PF Employee'])}</span>
                                        </div>
                                      )}
                                      {p.deductions['ESI Employee'] > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">
                                            ESI (Employee)
                                            <span className="text-xs ml-1 text-muted-foreground/70">(0.75% of gross)</span>
                                          </span>
                                          <span className="tabular-nums font-medium text-destructive">{fmt(p.deductions['ESI Employee'])}</span>
                                        </div>
                                      )}
                                      {p.deductions['Professional Tax'] > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">Professional Tax <span className="text-xs text-muted-foreground/70">(state slab)</span></span>
                                          <span className="tabular-nums font-medium text-destructive">{fmt(p.deductions['Professional Tax'])}</span>
                                        </div>
                                      )}
                                      {p.deductions['TDS'] > 0 && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">TDS <span className="text-xs text-muted-foreground/70">(annual est. ÷ 12)</span></span>
                                          <span className="tabular-nums font-medium text-destructive">{fmt(p.deductions['TDS'])}</span>
                                        </div>
                                      )}
                                      {Object.entries(p.deductions)
                                        .filter(([k]) => !['PF Employee','ESI Employee','Professional Tax','TDS','Loss of Pay'].includes(k))
                                        .map(([k, v]) => (
                                          <div key={k} className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{k}</span>
                                            <span className="tabular-nums font-medium text-destructive">{fmt(v)}</span>
                                          </div>
                                        ))
                                      }
                                      {Object.keys(p.deductions).length === 0 && (
                                        <p className="text-sm text-muted-foreground">No deductions applicable</p>
                                      )}
                                      <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5 mt-1 text-destructive">
                                        <span>Total Deductions</span>
                                        <span className="tabular-nums">{fmt(p.total_deductions)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Net salary callout */}
                                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">
                                    Net Salary = Gross {fmt(p.gross_salary)} − Deductions {fmt(p.total_deductions)}
                                  </span>
                                  <span className="text-lg font-bold text-kpi-green tabular-nums">{fmt(p.net_salary)}</span>
                                </div>

                                {/* Manual adjustment diff */}
                                {p.is_manually_adjusted && p.original_net_salary !== null && (() => {
                                  // Compute which deductions were waived/reduced (concessions)
                                  // and which were added/increased
                                  const origDed  = p.original_deductions ?? {}
                                  const currDed  = p.deductions
                                  const allKeys  = Array.from(new Set([...Object.keys(origDed), ...Object.keys(currDed)]))
                                  const changes  = allKeys
                                    .map(k => ({ label: k, before: Math.round(origDed[k] ?? 0), after: Math.round(currDed[k] ?? 0) }))
                                    .filter(c => c.before !== c.after)
                                  return (
                                    <div className="mt-3 rounded-lg border border-kpi-amber/40 bg-kpi-amber/5 p-3 space-y-2">
                                      <p className="text-xs font-semibold text-kpi-amber flex items-center gap-1.5">
                                        <ArrowLeftRight className="h-3.5 w-3.5" />
                                        {p.net_salary > Number(p.original_net_salary) ? 'HR Concession Applied' : 'Manual Adjustment Applied'}
                                      </p>
                                      <div className="flex items-center gap-3 text-sm">
                                        <div className="text-muted-foreground">
                                          System: <span className="line-through tabular-nums">{fmt(Number(p.original_net_salary))}</span>
                                        </div>
                                        <span className="text-muted-foreground">→</span>
                                        <div className="font-medium text-kpi-green">
                                          HR Approved: <span className="tabular-nums">{fmt(p.net_salary)}</span>
                                        </div>
                                        <div className={`text-xs font-medium ${p.net_salary > Number(p.original_net_salary) ? 'text-kpi-green' : 'text-destructive'}`}>
                                          ({p.net_salary > Number(p.original_net_salary) ? '+' : ''}{fmt(p.net_salary - Number(p.original_net_salary))})
                                        </div>
                                      </div>
                                      {changes.length > 0 && (
                                        <div className="border-t border-kpi-amber/20 pt-2 space-y-1">
                                          <p className="text-xs font-medium text-foreground mb-1">What changed:</p>
                                          {changes.map(c => (
                                            <div key={c.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                                              <span className="font-medium text-foreground w-36 shrink-0">{c.label}</span>
                                              <span className="line-through tabular-nums">{fmt(c.before)}</span>
                                              <span>→</span>
                                              <span className={`tabular-nums font-medium ${c.after < c.before ? 'text-kpi-green' : 'text-destructive'}`}>{fmt(c.after)}</span>
                                              <span className={c.after < c.before ? 'text-kpi-green' : 'text-destructive'}>
                                                ({c.after < c.before ? `−${fmt(c.before - c.after)} waived` : `+${fmt(c.after - c.before)} added`})
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Footer */}
      {run && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 p-4 bg-card border border-border rounded-lg">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={payslips.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={payslips.length === 0}>
              <FileText className="h-4 w-4 mr-1.5" /> Download Register PDF
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={payslips.length === 0}
              onClick={handleExportForReview}
              title="Download Excel for offline editing. Upload the modified file back to apply adjustments."
            >
              <FileSpreadsheet className="h-4 w-4 mr-1.5 text-kpi-amber" /> Export for Review
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={payslips.length === 0}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/payroll/runs/${run.id}/attendance-report`)
                  if (!res.ok) throw new Error('Failed')
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `payroll_attendance_${monthLabel.replace(' ', '_')}.xlsx`
                  a.click()
                  URL.revokeObjectURL(url)
                } catch {
                  toast.error('Failed to generate attendance report')
                }
              }}
              title="Detailed day-by-day attendance used for payroll calculation"
            >
              <Download className="h-4 w-4 mr-1.5 text-primary" /> Attendance Report
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={isApproved || payslips.length === 0}
              onClick={() => { setAdjModal(true); setAdjResult(null); setAdjFile(null) }}
            >
              <Upload className="h-4 w-4 mr-1.5" /> Upload Adjustments
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {/* "Approve Selected" appears once HR ticks ≥1 row. We keep it next
                to the existing button rather than as a separate floating bar
                because the action area is already the home for the approve
                affordance — discoverability + muscle memory. */}
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={() => { setApproveScope('selected'); setApproveModal(true) }}
                disabled={isApproved || approving}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Approve Selected ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="outline" size="sm"
              disabled={allApproved || payslips.length === 0}
              onClick={() => { setApproveScope('all'); setApproveModal(true) }}
              title={
                allApproved
                  ? 'All payslips in this run are already approved'
                  : approvedCount > 0
                    ? `Approve the remaining ${unapprovedPayslips.length} payslip(s)`
                    : undefined
              }
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {allApproved
                ? 'Payroll Approved ✓'
                : approvedCount > 0
                  ? `Approve Remaining (${unapprovedPayslips.length})`
                  : 'Approve Payroll'}
            </Button>
          </div>
        </div>
      )}

      {/* Upload Adjustments Modal */}
      <Dialog open={adjModal} onOpenChange={v => { setAdjModal(v); if (!v) { setAdjFile(null); setAdjResult(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Payroll Adjustments</DialogTitle>
            <DialogDescription>
              Upload the reviewed Excel file. The system will compare each row to the current payslip, save the original values, and apply your changes.
            </DialogDescription>
          </DialogHeader>

          {!adjResult ? (
            <div className="space-y-4">
              <div
                className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('adj-file-input')?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setAdjFile(f) }}
              >
                {adjFile ? (
                  <div>
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-kpi-green" />
                    <p className="text-sm font-medium">{adjFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(adjFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Click or drag to upload</p>
                    <p className="text-xs text-muted-foreground">Excel file exported from "Export for Review"</p>
                  </div>
                )}
              </div>
              <input id="adj-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setAdjFile(f); e.target.value = '' }} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-kpi-green/10 p-3">
                  <p className="text-2xl font-bold text-kpi-green">{adjResult.adjusted}</p>
                  <p className="text-xs text-muted-foreground">Adjusted</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-2xl font-bold">{adjResult.unchanged}</p>
                  <p className="text-xs text-muted-foreground">Unchanged</p>
                </div>
                <div className="rounded-lg bg-destructive/10 p-3">
                  <p className="text-2xl font-bold text-destructive">{adjResult.not_found}</p>
                  <p className="text-xs text-muted-foreground">Not Found</p>
                </div>
              </div>
              {adjResult.diffs.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Employee</th>
                        <th className="text-right px-3 py-2">Original Net</th>
                        <th className="text-right px-3 py-2">Adjusted Net</th>
                        <th className="text-right px-3 py-2">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjResult.diffs.map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5">{d.name} <span className="text-muted-foreground">({d.emp_code})</span></td>
                          <td className="px-3 py-1.5 text-right tabular-nums line-through text-muted-foreground">{fmt(d.original_net)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-kpi-green">{fmt(d.adjusted_net)}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums text-xs ${d.adjusted_net > d.original_net ? 'text-kpi-green' : 'text-destructive'}`}>
                            {d.adjusted_net > d.original_net ? '+' : ''}{fmt(d.adjusted_net - d.original_net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Skipped rows — surfaces the per-row reason so HR can
                  diagnose "0 updated" without guessing. */}
              {adjResult.skipped && adjResult.skipped.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-900/10">
                  <div className="px-3 py-2 border-b border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Rows not adjusted ({adjResult.skipped.length})
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-amber-100/50 dark:bg-amber-900/20 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-1.5 w-14">Row</th>
                          <th className="text-left px-3 py-1.5 w-28">Emp Code</th>
                          <th className="text-left px-3 py-1.5">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adjResult.skipped.map((s, i) => (
                          <tr key={i} className="border-t border-amber-500/10">
                            <td className="px-3 py-1.5 tabular-nums">{s.row}</td>
                            <td className="px-3 py-1.5 font-mono">{s.emp_code || '—'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{s.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjModal(false)}>
              {adjResult ? 'Close' : 'Cancel'}
            </Button>
            {!adjResult && (
              <Button onClick={handleImportAdjustments} disabled={!adjFile || adjUploading}>
                {adjUploading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</>
                  : <><Upload className="h-4 w-4 mr-2" />Apply Adjustments</>
                }
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Modal — reused for both whole-run and selective approval.
          The copy + totals shift based on `approveScope` so HR can't confuse
          the two; everything else (the spinner, the API call dispatch) lives
          in handleApprove and reads the same state. */}
      <Dialog open={approveModal} onOpenChange={setApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approveScope === 'selected'
                ? `Approve ${selectedIds.size} Selected Payslip${selectedIds.size === 1 ? '' : 's'}`
                : approvedCount > 0
                  ? `Approve Remaining ${unapprovedPayslips.length} Payslip${unapprovedPayslips.length === 1 ? '' : 's'}`
                  : 'Approve Payroll'}
            </DialogTitle>
            <DialogDescription>
              {approveScope === 'selected' ? (
                <>
                  You are about to approve {selectedIds.size} payslip{selectedIds.size === 1 ? '' : 's'} for{' '}
                  {monthLabel}. Net payout for the selected employees:{' '}
                  <strong>{fmt(selectedNetTotal)}</strong>. These payslips will be published
                  and emailed immediately. The rest of the run will stay in Draft.
                </>
              ) : approvedCount > 0 ? (
                <>
                  You are about to approve the remaining {unapprovedPayslips.length} payslip
                  {unapprovedPayslips.length === 1 ? '' : 's'} for {monthLabel}. The {approvedCount}{' '}
                  already-approved payslip{approvedCount === 1 ? '' : 's'} will not be re-sent.
                  This will finalize the run.
                </>
              ) : (
                <>
                  You are about to approve payroll for {monthLabel} — Net payout:{' '}
                  {run ? fmt(Number(run.total_net)) : '—'} for {payslips.length} employees.
                  This will publish payslips to all employees. This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModal(false)}>Cancel</Button>
            <Button
              onClick={handleApprove}
              disabled={approving || (approveScope === 'selected' && selectedIds.size === 0)}
            >
              {approving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Approving...</> : 'Confirm Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-payslip line-item editor. Lives at the page root (not inside
          the payslip row) so the dialog backdrop covers the full viewport
          and isn't constrained by the table's overflow rules. */}
      <EditPayslipModal
        payslip={editPayslip}
        open={editOpen}
        onOpenChange={(v) => { setEditOpen(v); if (!v) setEditPayslip(null) }}
        onSaved={() => fetchPayrollData()}
      />

    </AppLayout>
  )
}

export default Payroll