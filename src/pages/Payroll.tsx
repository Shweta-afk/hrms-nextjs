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
  FileText, CheckCircle2, Loader2, Play,
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

  const currentMonth = ((now.getMonth() + monthOffset) % 12) + 1
  const currentYear = now.getFullYear() + Math.floor((now.getMonth() + monthOffset) / 12)
  const monthLabel = `${monthNames[currentMonth - 1]} ${currentYear}`

  async function fetchPayrollData() {
    setLoading(true)
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
        body: JSON.stringify({ payroll_run_id: runId }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Payroll processed — ${json.data.employees_processed} employees`)
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

  function handleViewPayslip(payslipId: string) {
    const payslip = payslips.find(p => p.id === payslipId)
    if (!payslip) return
    const f = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN")
    const earningRows = Object.entries(payslip.earnings)
      .map(([l, a]) => `<tr><td>${l}</td><td style="text-align:right">${f(a)}</td></tr>`).join('')
    const deductionRows = Object.entries(payslip.deductions)
      .map(([l, a]) => `<tr><td>${l}</td><td style="text-align:right">${f(a)}</td></tr>`).join('')
    const html = `<!DOCTYPE html><html><head><title>Payslip</title>
    <style>body{font-family:Arial,sans-serif;font-size:13px;margin:32px}h1{text-align:center;font-size:20px;margin:0}.sub{text-align:center;color:#555;margin:4px 0 16px}hr{border:none;border-top:1px solid #ddd;margin:16px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:16px 0}.row{display:flex;justify-content:space-between;padding:4px 0}.label{color:#555}table{width:100%;border-collapse:collapse}table td{padding:7px 8px;border-bottom:1px solid #eee;font-size:12px}table td:last-child{text-align:right}.total td{font-weight:bold;background:#f5f5ff;border-top:2px solid #1e1b4b}.two-col{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ddd;border-radius:6px;overflow:hidden}.col:first-child{border-right:1px solid #ddd}.col-hdr{background:#f5f5f5;padding:8px 12px;font-size:11px;font-weight:bold;text-transform:uppercase;color:#555}.net{text-align:center;border:2px solid #16a34a;border-radius:8px;padding:16px;margin:16px 0;background:#f0fdf4}.net-amt{font-size:28px;font-weight:bold;color:#16a34a}.footer{text-align:center;font-size:11px;color:#888;margin-top:24px}@media print{button{display:none}}</style>
    </head><body>
    <button onclick="window.print()" style="float:right;padding:8px 16px;background:#4f46e5;color:white;border:none;border-radius:6px;cursor:pointer">🖨 Print / Save PDF</button>
    <h1>Demo Company Pvt. Ltd.</h1>
    <p class="sub">Payslip for ${monthLabel}</p><hr>
    <div class="grid">
      <div>
        <div class="row"><span class="label">Name</span><span>${payslip.employee.first_name} ${payslip.employee.last_name}</span></div>
        <div class="row"><span class="label">Employee ID</span><span>${payslip.employee.emp_code}</span></div>
        <div class="row"><span class="label">Department</span><span>${payslip.employee.department?.name ?? '—'}</span></div>
        <div class="row"><span class="label">Designation</span><span>${payslip.employee.designation?.name ?? '—'}</span></div>
      </div>
      <div>
        <div class="row"><span class="label">Pay Period</span><span>${monthLabel}</span></div>
        <div class="row"><span class="label">Working Days</span><span>${payslip.working_days}</span></div>
        <div class="row"><span class="label">Days Present</span><span>${payslip.present_days}</span></div>
        <div class="row"><span class="label">LOP Days</span><span>${Math.max(0, payslip.working_days - Number(payslip.present_days))}</span></div>
      </div>
    </div><hr>
    <div class="two-col">
      <div class="col"><div class="col-hdr">Earnings</div>
        <table><tbody>${earningRows}</tbody><tfoot><tr class="total"><td>Total Earnings</td><td style="text-align:right">${f(payslip.gross_salary)}</td></tr></tfoot></table>
      </div>
      <div class="col"><div class="col-hdr">Deductions</div>
        <table><tbody>${deductionRows}</tbody><tfoot><tr class="total"><td>Total Deductions</td><td style="text-align:right">${f(payslip.total_deductions)}</td></tr></tfoot></table>
      </div>
    </div>
    <div class="net"><div style="font-size:12px;color:#555;margin-bottom:4px">NET SALARY</div>
      <div class="net-amt">${f(payslip.net_salary)}</div>
    </div><hr>
    <div class="footer"><p>This is a computer-generated payslip and does not require a signature.</p></div>
    </body></html>`
    const win = window.open('', '_blank')
    if (!win) { toast.error('Please allow popups'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
  }

  function handleExportExcel() {
    if (payslips.length === 0) { toast.error('No payslips to export'); return }
    const headers = ['Employee','Code','Department','Basic','HRA','Special Allowance','Gross','PF','ESI','PT','TDS','LOP','Net Pay']
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
    const printContent = `<!DOCTYPE html><html><head><title>Payroll Register — ${monthLabel}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h1{font-size:18px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e1b4b;color:#fff;padding:8px 6px;text-align:right;font-size:11px}th:first-child{text-align:left}td{padding:7px 6px;border-bottom:1px solid #eee;text-align:right;font-size:11px}td:first-child{text-align:left;font-weight:500}.net{color:#16a34a;font-weight:700}tfoot td{font-weight:700;border-top:2px solid #1e1b4b;background:#f8f9ff}</style>
    </head><body>
    <h1>Payroll Register — ${monthLabel}</h1>
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
          <Button className="h-9 font-semibold" onClick={handleRunPayroll} disabled={running || isApproved}>
            {running
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
              : <><Play className="h-4 w-4 mr-2" />Run Payroll</>
            }
          </Button>
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
                    <TableHead className="text-center">Payslip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {p.employee.first_name} {p.employee.last_name}
                        <p className="text-xs text-muted-foreground">{p.employee.emp_code}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(p.earnings['Basic'] ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(p.earnings['HRA'] ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(p.earnings['Special Allowance'] ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmt(p.gross_salary)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{p.deductions['PF Employee'] ? fmt(p.deductions['PF Employee']) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{p.deductions['ESI Employee'] ? fmt(p.deductions['ESI Employee']) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{p.deductions['Professional Tax'] ? fmt(p.deductions['Professional Tax']) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{p.deductions['TDS'] ? fmt(p.deductions['TDS']) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-kpi-green">{fmt(p.net_salary)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={isApproved ? 'active' : 'secondary'} className="text-[10px]">
                          {isApproved ? 'Approved' : 'Draft'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => handleViewPayslip(p.id)}
                          disabled={!isApproved}
                          className="text-xs font-medium text-primary hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {isApproved ? 'View / Print' : '—'}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Footer — always visible when run exists */}
      {run && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 p-4 bg-card border border-border rounded-lg">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={payslips.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Export to Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={payslips.length === 0}>
              <FileText className="h-4 w-4 mr-1.5" /> Download Register PDF
            </Button>
          </div>
          <Button
            size="lg"
            className="bg-kpi-green hover:bg-kpi-green/90 text-white font-semibold"
            disabled={isApproved || payslips.length === 0}
            onClick={() => setApproveModal(true)}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {isApproved ? 'Payroll Approved ✓' : 'Approve Payroll'}
          </Button>
        </div>
      )}

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
              {approving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Approving...</> : 'Confirm Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  )
}

export default Payroll