'use client'

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Payslip {
  id: string;
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
    email: string;
    date_of_joining: string;
    department: { name: string } | null;
    designation: { name: string } | null;
  };
  payroll_run: {
    month: number;
    year: number;
    status: string;
  };
}

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN")

function numberToWords(n: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"]
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"]
  if (n === 0) return "Zero"
  const convert = (num: number): string => {
    if (num < 20) return ones[num]
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? "-"+ones[num%10] : "")
    if (num < 1000) return ones[Math.floor(num/100)] + " Hundred" + (num%100 ? " "+convert(num%100) : "")
    if (num < 100000) return convert(Math.floor(num/1000)) + " Thousand" + (num%1000 ? " "+convert(num%1000) : "")
    if (num < 10000000) return convert(Math.floor(num/100000)) + " Lakh" + (num%100000 ? " "+convert(num%100000) : "")
    return convert(Math.floor(num/10000000)) + " Crore" + (num%10000000 ? " "+convert(num%10000000) : "")
  }
  return convert(Math.round(n)) + " Rupees Only"
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-1">
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
)

const Payslip = () => {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  async function fetchPayslips() {
    setLoading(true)
    try {
      const res = await fetch('/api/payroll/payslips')
      const json = await res.json()
      if (json.success && json.data.length > 0) {
        setPayslips(json.data)
        setSelectedId(json.data[0].id)
      }
    } catch {
      toast.error('Failed to load payslips')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPayslips() }, [])

  const payslip = payslips.find(p => p.id === selectedId)

  function handlePrint() {
    if (!payslip) return
    window.print()
  }

  function handleDownloadPDF() {
    if (!payslip) return

    const emp = payslip.employee
    const monthLabel = `${monthNames[payslip.month - 1]} ${payslip.year}`
    const lopDays = payslip.working_days - Number(payslip.present_days)

    const earningRows = Object.entries(payslip.earnings)
      .map(([label, amount]) => `
        <tr>
          <td>${label}</td>
          <td style="text-align:right">${fmt(amount)}</td>
        </tr>
      `).join('')

    const deductionRows = Object.entries(payslip.deductions)
      .map(([label, amount]) => `
        <tr>
          <td>${label}</td>
          <td style="text-align:right">${fmt(amount)}</td>
        </tr>
      `).join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip — ${emp.first_name} ${emp.last_name} — ${monthLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 13px; color: #000; margin: 32px; }
          h1 { text-align: center; font-size: 20px; margin: 0; }
          .subtitle { text-align: center; color: #555; margin: 4px 0 16px; font-size: 13px; }
          hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin: 16px 0; }
          .label { color: #555; }
          .row { display: flex; justify-content: space-between; padding: 4px 0; }
          table { width: 100%; border-collapse: collapse; }
          table th { background: #1e1b4b; color: #fff; padding: 8px; font-size: 12px; text-align: left; }
          table td { padding: 7px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
          table td:last-child { text-align: right; }
          .total-row td { font-weight: bold; background: #f5f5ff; border-top: 2px solid #1e1b4b; }
          .net { text-align: center; border: 2px solid #16a34a; border-radius: 8px; padding: 16px; margin: 16px 0; background: #f0fdf4; }
          .net-amount { font-size: 28px; font-weight: bold; color: #16a34a; }
          .net-words { font-size: 11px; color: #555; font-style: italic; }
          .footer { text-align: center; font-size: 11px; color: #888; margin-top: 24px; }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
          .two-col .col { }
          .two-col .col:first-child { border-right: 1px solid #ddd; }
          .col-header { background: #f5f5f5; padding: 8px 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #555; letter-spacing: 0.05em; }
        </style>
      </head>
      <body>
        <h1>Demo Company Pvt. Ltd.</h1>
        <p class="subtitle">Payslip for ${monthLabel}</p>
        <hr>
        <div class="grid">
          <div>
            <div class="row"><span class="label">Name</span><span>${emp.first_name} ${emp.last_name}</span></div>
            <div class="row"><span class="label">Employee ID</span><span>${emp.emp_code}</span></div>
            <div class="row"><span class="label">Designation</span><span>${emp.designation?.name ?? '—'}</span></div>
            <div class="row"><span class="label">Department</span><span>${emp.department?.name ?? '—'}</span></div>
          </div>
          <div>
            <div class="row"><span class="label">Pay Period</span><span>01 ${monthLabel} – ${new Date(payslip.year, payslip.month, 0).getDate()} ${monthLabel}</span></div>
            <div class="row"><span class="label">Working Days</span><span>${payslip.working_days}</span></div>
            <div class="row"><span class="label">Days Present</span><span>${payslip.present_days}</span></div>
            <div class="row"><span class="label">LOP Days</span><span>${lopDays}</span></div>
          </div>
        </div>
        <hr>
        <div class="two-col">
          <div class="col">
            <div class="col-header">Earnings</div>
            <table>
              <tbody>${earningRows}</tbody>
              <tfoot><tr class="total-row"><td>Total Earnings</td><td style="text-align:right">${fmt(payslip.gross_salary)}</td></tr></tfoot>
            </table>
          </div>
          <div class="col">
            <div class="col-header">Deductions</div>
            <table>
              <tbody>${deductionRows}</tbody>
              <tfoot><tr class="total-row"><td>Total Deductions</td><td style="text-align:right">${fmt(payslip.total_deductions)}</td></tr></tfoot>
            </table>
          </div>
        </div>
        <div class="net">
          <div style="font-size:12px;color:#555;margin-bottom:4px;">NET SALARY</div>
          <div class="net-amount">${fmt(payslip.net_salary)}</div>
          <div class="net-words">${numberToWords(payslip.net_salary)}</div>
        </div>
        <hr>
        <div class="footer">
          <p>This is a computer-generated payslip and does not require a signature.</p>
          <p>HR Contact: hr@demo.com</p>
        </div>
      </body>
      </html>
    `

    const win = window.open('', '_blank')
    if (!win) { toast.error('Please allow popups'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
    toast.success('Opening payslip for download')
  }

  // Build month options from available payslips
  const monthOptions = payslips.map(p => ({
    id: p.id,
    label: `${monthNames[p.month - 1]} ${p.year}`,
  }))

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Print styles */}
      <style>{`
        @media print {
          header, .no-print { display: none !important; }
          body { background: white; }
          #payslip-card { box-shadow: none; border: 1px solid #ddd; }
        }
      `}</style>

      {/* Top Nav */}
      <header className="no-print sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight text-foreground">HRMS</span>
          <span className="text-sm text-muted-foreground">
            {payslip ? `${payslip.employee.first_name} ${payslip.employee.last_name}` : 'Loading...'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <p className="text-xs text-muted-foreground no-print">
          Home › Payroll › <span className="text-foreground font-medium">Payslip</span>
        </p>

        {/* Controls */}
        <div className="flex items-center justify-between no-print">
          <h1 className="text-2xl font-bold text-foreground">Payslip</h1>
          <div className="flex items-center gap-3">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!payslip}>
              <Printer className="mr-1.5 h-4 w-4" /> Print
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} disabled={!payslip}>
              <Download className="mr-1.5 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !payslip ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No payslips available yet.</p>
            <p className="text-xs mt-1">Ask your HR admin to run and approve payroll.</p>
          </div>
        ) : (
          <Card className="shadow-md" id="payslip-card">
            <CardContent className="p-8 space-y-6" ref={printRef}>

              {/* Header */}
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Demo Company Pvt. Ltd.</h2>
                <p className="text-sm text-muted-foreground">
                  Payslip for {monthNames[payslip.month - 1]} {payslip.year}
                </p>
              </div>
              <Separator />

              {/* Employee & Payroll Details */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Employee Details
                  </h3>
                  <DetailRow label="Name" value={`${payslip.employee.first_name} ${payslip.employee.last_name}`} />
                  <DetailRow label="Employee ID" value={payslip.employee.emp_code} />
                  <DetailRow label="Designation" value={payslip.employee.designation?.name ?? '—'} />
                  <DetailRow label="Department" value={payslip.employee.department?.name ?? '—'} />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Payroll Details
                  </h3>
                  <DetailRow
                    label="Pay Period"
                    value={`01 ${monthNames[payslip.month - 1]} ${payslip.year} – ${new Date(payslip.year, payslip.month, 0).getDate()} ${monthNames[payslip.month - 1]} ${payslip.year}`}
                  />
                  <DetailRow label="Working Days" value={String(payslip.working_days)} />
                  <DetailRow label="Days Present" value={String(payslip.present_days)} />
                  <DetailRow
                    label="LOP Days"
                    value={String(Math.max(0, payslip.working_days - Number(payslip.present_days)))}
                  />
                </div>
              </div>

              <Separator />

              {/* Earnings & Deductions */}
              <div className="grid grid-cols-2 gap-0 border rounded-md overflow-hidden">
                {/* Earnings */}
                <div className="border-r">
                  <div className="bg-muted px-4 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earnings</h3>
                  </div>
                  <div className="divide-y">
                    {Object.entries(payslip.earnings).map(([label, amount]) => (
                      <div key={label} className="flex justify-between px-4 py-2.5">
                        <span className="text-sm text-foreground">{label}</span>
                        <span className="text-sm font-mono text-foreground">{fmt(amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t bg-muted/50 flex justify-between px-4 py-3">
                    <span className="text-sm font-bold text-foreground">Total Earnings</span>
                    <span className="text-base font-bold font-mono text-foreground">{fmt(payslip.gross_salary)}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <div className="bg-muted px-4 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deductions</h3>
                  </div>
                  <div className="divide-y">
                    {Object.entries(payslip.deductions).map(([label, amount]) => (
                      <div key={label} className="flex justify-between px-4 py-2.5">
                        <span className="text-sm text-foreground">{label}</span>
                        <span className="text-sm font-mono text-foreground">{fmt(amount)}</span>
                      </div>
                    ))}
                    {Object.keys(payslip.deductions).length === 0 && (
                      <div className="px-4 py-2.5 text-sm text-muted-foreground italic">No deductions</div>
                    )}
                  </div>
                  <div className="border-t bg-muted/50 flex justify-between px-4 py-3">
                    <span className="text-sm font-bold text-foreground">Total Deductions</span>
                    <span className="text-base font-bold font-mono text-destructive">{fmt(payslip.total_deductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Salary */}
              <div className="rounded-md border-2 border-green-600/30 bg-green-50 dark:bg-green-950/20 p-5 text-center space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Salary</p>
                <p className="text-3xl font-bold font-mono text-green-700 dark:text-green-400">
                  {fmt(payslip.net_salary)}
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Amount in words: {numberToWords(payslip.net_salary)}
                </p>
              </div>

              <Separator />

              {/* Footer */}
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground italic">
                  This is a computer-generated payslip and does not require a signature.
                </p>
                <p className="text-xs text-muted-foreground">HR Contact: hr@demo.com</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

export default Payslip