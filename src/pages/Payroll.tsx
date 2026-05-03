'use client'

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
import {
  ChevronLeft, ChevronRight, AlertTriangle, CircleAlert, FileSpreadsheet,
  FileText, CheckCircle2, X, Loader2, Play,
} from "lucide-react";
import { toast } from "sonner";

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
  employee: {
    first_name: string;
    last_name: string;
    emp_code: string;
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

  const currentMonth = now.getMonth() + 1 + monthOffset > 12
    ? (now.getMonth() + 1 + monthOffset) % 12
    : now.getMonth() + 1 + monthOffset
  const currentYear = now.getFullYear() + Math.floor((now.getMonth() + monthOffset) / 12)
  const monthLabel = `${monthNames[currentMonth - 1]} ${currentYear}`

  async function fetchPayrollData() {
    setLoading(true)
    try {
      // Fetch runs
      const runsRes = await fetch('/api/payroll/runs')
      const runsJson = await runsRes.json()
      if (runsJson.success) {
        const currentRun = runsJson.data.find(
          (r: PayrollRun) => r.month === currentMonth && r.year === currentYear
        )
        setRun(currentRun || null)

        // Fetch payslips for this month
        if (currentRun) {
          const slipsRes = await fetch(`/api/payroll/payslips?payroll_run_id=${currentRun.id}`)
          const slipsJson = await slipsRes.json()
          if (slipsJson.success) setPayslips(slipsJson.data)
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

  async function handleRunPayroll() {
    setRunning(true)
    try {
      // Create run if doesn't exist
      let runId = run?.id
      if (!run) {
        const createRes = await fetch('/api/payroll/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: currentMonth, year: currentYear }),
        })
        const createJson = await createRes.json()
        if (!createJson.success) {
          toast.error(createJson.error)
          return
        }
        runId = createJson.data.id
      }

      // Run payroll computation
      const runRes = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payroll_run_id: runId }),
      })
      const runJson = await runRes.json()
      if (runJson.success) {
        toast.success(`Payroll processed — ${runJson.data.employees_processed} employees`)
        fetchPayrollData()
      } else {
        toast.error(runJson.error)
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
      const res = await fetch(`/api/payroll/runs/${run.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Payroll approved — payslips published to employees')
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
  function handleDownloadPDF() {
    if (payslips.length === 0) { toast.error('No payslips to download'); return }

    const printContent = `
     <!DOCTYPE html>
     <html>
     <head>
      <title>Payroll Register — ${monthLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { margin: 2px 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #1e1b4b; color: #fff; padding: 8px 6px; text-align: right; font-size: 11px; }
        th:first-child { text-align: left; }
        td { padding: 7px 6px; border-bottom: 1px solid #eee; text-align: right; font-size: 11px; }
        td:first-child { text-align: left; font-weight: 500; }
        .net { color: #16a34a; font-weight: 700; }
        tfoot td { font-weight: 700; border-top: 2px solid #1e1b4b; background: #f8f9ff; }
        .footer { margin-top: 24px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 8px; }
      </style>
     </head>
     <body>
      <h1>Payroll Register — ${monthLabel}</h1>
      <p>Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      <p>Employees: ${payslips.length} &nbsp;|&nbsp; Status: ${run?.status?.toUpperCase()}</p>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Basic</th>
            <th>HRA</th>
            <th>Special</th>
            <th>Gross</th>
            <th>PF</th>
            <th>ESI</th>
            <th>PT</th>
            <th>TDS</th>
            <th>Net Pay</th>
          </tr>
        </thead>
        <tbody>
          ${payslips.map(p => `
            <tr>
              <td>${p.employee.first_name} ${p.employee.last_name}<br><span style="color:#888;font-size:10px">${p.employee.emp_code}</span></td>
              <td>${fmt(p.earnings['Basic'] ?? 0)}</td>
              <td>${fmt(p.earnings['HRA'] ?? 0)}</td>
              <td>${fmt(p.earnings['Special Allowance'] ?? 0)}</td>
              <td><strong>${fmt(p.gross_salary)}</strong></td>
              <td>${p.deductions['PF Employee'] ? fmt(p.deductions['PF Employee']) : '—'}</td>
              <td>${p.deductions['ESI Employee'] ? fmt(p.deductions['ESI Employee']) : '—'}</td>
              <td>${p.deductions['Professional Tax'] ? fmt(p.deductions['Professional Tax']) : '—'}</td>
              <td>${p.deductions['TDS'] ? fmt(p.deductions['TDS']) : '—'}</td>
              <td class="net">${fmt(p.net_salary)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>TOTAL (${payslips.length} employees)</td>
            <td>${fmt(payslips.reduce((s, p) => s + (p.earnings['Basic'] ?? 0), 0))}</td>
            <td>${fmt(payslips.reduce((s, p) => s + (p.earnings['HRA'] ?? 0), 0))}</td>
            <td>${fmt(payslips.reduce((s, p) => s + (p.earnings['Special Allowance'] ?? 0), 0))}</td>
            <td>${fmt(Number(run?.total_gross ?? 0))}</td>
            <td>${fmt(payslips.reduce((s, p) => s + (p.deductions['PF Employee'] ?? 0), 0))}</td>
            <td>${fmt(payslips.reduce((s, p) => s + (p.deductions['ESI Employee'] ?? 0), 0))}</td>
            <td>${fmt(payslips.reduce((s, p) => s + (p.deductions['Professional Tax'] ?? 0), 0))}</td>
            <td>${fmt(payslips.reduce((s, p) => s + (p.deductions['TDS'] ?? 0), 0))}</td>
            <td class="net">${fmt(Number(run?.total_net ?? 0))}</td>
          </tr>
        </tfoot>
      </table>
      <div class="footer">
        This is a system-generated payroll register. &nbsp;|&nbsp; HRMS SaaS
      </div>
    </body>
    </html>
   `

   const printWindow = window.open('', '_blank')
   if (!printWindow) { toast.error('Please allow popups to download PDF'); return }
   printWindow.document.write(printContent)
   printWindow.document.close()
   printWindow.focus()
   setTimeout(() => {
    printWindow.print()
    printWindow.close()
   }, 500)

   toast.success('Opening payroll register for download')
  }
  function handleExportExcel() {
    if (payslips.length === 0) { toast.error('No payslips to export'); return }

    const headers = ['Employee', 'Code', 'Department', 'Basic', 'HRA', 'Special Allowance', 'Gross', 'PF', 'ESI', 'PT', 'TDS', 'LOP', 'Net Pay']
    const rows = payslips.map(p => [
      `${p.employee.first_name} ${p.employee.last_name}`,
      p.employee.emp_code,
      p.employee.department?.name ?? '',
      p.earnings['Basic'] ?? 0,
      p.earnings['HRA'] ?? 0,
      p.earnings['Special Allowance'] ?? 0,
      p.gross_salary,
      p.deductions['PF Employee'] ?? 0,
      p.deductions['ESI Employee'] ?? 0,
      p.deductions['Professional Tax'] ?? 0,
      p.deductions['TDS'] ?? 0,
      p.deductions['Loss of Pay'] ?? 0,
      p.net_salary,
    ])

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payroll-${monthLabel.replace(' ', '-')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Payroll register exported')
  }

  const isApproved = run?.status === 'approved'
  const isDraft = !run || run.status === 'draft'
  const hasPayslips = payslips.length > 0

  
  return (
    <AppLayout title="Payroll">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setMonthOffset(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-28 text-center">{monthLabel}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setMonthOffset(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="h-9 font-semibold"
            onClick={handleRunPayroll}
            disabled={running || isApproved}
          >
            {running
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
              : <><Play className="h-4 w-4 mr-2" /> Run Payroll</>
            }
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {loading ? null : !run ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 mb-5">
          <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            No payroll run for <span className="font-semibold">{monthLabel}</span>. Click "Run Payroll" to start.
          </p>
        </div>
      ) : run.status === 'processing' || run.status === 'draft' ? (
        <div className="flex items-center gap-3 rounded-lg border border-kpi-amber/30 bg-kpi-amber/8 px-4 py-3 mb-5">
          <AlertTriangle className="h-4 w-4 text-kpi-amber shrink-0" />
          <p className="flex-1 text-sm text-foreground">
            Payroll for <span className="font-semibold">{monthLabel}</span> is in{' '}
            <Badge variant="notice" className="mx-1 text-[10px]">DRAFT</Badge>.
            Review and approve.
          </p>
        </div>
      ) : isApproved ? (
        <div className="flex items-center gap-3 rounded-lg border border-kpi-green/30 bg-kpi-green/8 px-4 py-3 mb-5">
          <CheckCircle2 className="h-4 w-4 text-kpi-green shrink-0" />
          <p className="text-sm text-foreground">
            Payroll for <span className="font-semibold">{monthLabel}</span> has been{' '}
            <Badge variant="active" className="mx-1 text-[10px]">APPROVED</Badge>.
            Payslips are visible to employees.
          </p>
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Total Gross Payroll</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {run ? fmt(Number(run.total_gross)) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Total Deductions</p>
            <p className="text-2xl font-bold tabular-nums text-destructive">
              {run ? fmt(Number(run.total_deductions)) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-kpi-green/20">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Net Payout</p>
            <p className="text-2xl font-bold tabular-nums text-kpi-green">
              {run ? fmt(Number(run.total_net)) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Employees Processed</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {payslips.length} <span className="text-base font-normal text-muted-foreground">employees</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies */}
      {showAnomalies && hasPayslips && !isApproved && (
        <Card className="border-l-4 border-l-kpi-amber mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CircleAlert className="h-4 w-4 text-kpi-amber" />
              Review Before Approving
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {payslips.some(p => p.deductions['Loss of Pay'] > 0) && (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-kpi-amber shrink-0" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground w-16">Warning</span>
                <span>{payslips.filter(p => p.deductions['Loss of Pay'] > 0).length} employee(s) have LOP deductions</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground w-16">Info</span>
              <span>{payslips.length} employee(s) included in this payroll run</span>
            </div>
            <button
              onClick={() => setShowAnomalies(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
            >
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
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : payslips.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {run
                ? 'No payslips generated yet. Click Run Payroll to process.'
                : 'No payroll run for this month. Click Run Payroll to start.'
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">HRA</TableHead>
                    <TableHead className="text-right">Special</TableHead>
                    <TableHead className="text-right font-semibold">Gross</TableHead>
                    <TableHead className="text-right">PF</TableHead>
                    <TableHead className="text-right">ESI</TableHead>
                    <TableHead className="text-right">PT</TableHead>
                    <TableHead className="text-right">TDS</TableHead>
                    <TableHead className="text-right font-semibold">Net Pay</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {p.employee.first_name} {p.employee.last_name}
                        <p className="text-xs text-muted-foreground">{p.employee.emp_code}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmt(p.earnings['Basic'] ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmt(p.earnings['HRA'] ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmt(p.earnings['Special Allowance'] ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {fmt(p.gross_salary)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.deductions['PF Employee'] ? fmt(p.deductions['PF Employee']) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.deductions['ESI Employee'] ? fmt(p.deductions['ESI Employee']) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.deductions['Professional Tax'] ? fmt(p.deductions['Professional Tax']) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.deductions['TDS'] ? fmt(p.deductions['TDS']) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-kpi-green">
                        {fmt(p.net_salary)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={isApproved ? 'active' : 'secondary'} className="text-[10px]">
                          {isApproved ? 'Approved' : 'Draft'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {hasPayslips && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-5 mt-4 border-t">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Export to Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                 <FileText className="h-4 w-4 mr-1.5" /> Download Register PDF
                </Button>
              </div>
              <Button
                size="lg"
                className="bg-kpi-green hover:bg-kpi-green/90 text-white font-semibold"
                disabled={isApproved || !hasPayslips}
                onClick={() => setApproveModal(true)}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {isApproved ? 'Payroll Approved' : 'Approve Payroll'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Modal */}
      <Dialog open={approveModal} onOpenChange={setApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payroll</DialogTitle>
            <DialogDescription>
              You are about to approve payroll for {monthLabel} — Net payout:{' '}
              {run ? fmt(Number(run.total_net)) : '—'} for {payslips.length} employees.
              This will publish payslips to all employees. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveModal(false)}>Cancel</Button>
            <Button
              className="bg-kpi-green hover:bg-kpi-green/90 text-white"
              onClick={handleApprove}
              disabled={approving}
            >
              {approving
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Approving...</>
                : 'Confirm Approve'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default Payroll