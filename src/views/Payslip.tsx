'use client'

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";
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

interface OrgInfo {
  name: string;
  logo_url?: string;
  address?: string;
  gst_number?: string;
  tan_number?: string;
  phone?: string;
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
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " "+ones[num%10] : "")
    if (num < 1000) return ones[Math.floor(num/100)] + " Hundred" + (num%100 ? " "+convert(num%100) : "")
    if (num < 100000) return convert(Math.floor(num/1000)) + " Thousand" + (num%1000 ? " "+convert(num%1000) : "")
    if (num < 10000000) return convert(Math.floor(num/100000)) + " Lakh" + (num%100000 ? " "+convert(num%100000) : "")
    return convert(Math.floor(num/10000000)) + " Crore" + (num%10000000 ? " "+convert(num%10000000) : "")
  }
  return convert(Math.round(n)) + " Rupees Only"
}

const Payslip = () => {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [orgInfo, setOrgInfo] = useState<OrgInfo>({ name: '' })

  async function fetchPayslips() {
    setLoading(true)
    try {
      const [slipRes, orgRes] = await Promise.all([
        fetch('/api/payroll/payslips'),
        fetch('/api/org/settings'),
      ])
      const slipJson = await slipRes.json()
      const orgJson = await orgRes.json()
      if (slipJson.success && slipJson.data.length > 0) {
        setPayslips(slipJson.data)
        setSelectedId(slipJson.data[0].id)
      }
      if (orgJson.success) {
        const s = orgJson.data as Record<string, unknown>
        setOrgInfo({
          name:       (s.company_name as string) || '',
          logo_url:   s.logo_url   as string | undefined,
          address:    s.address    as string | undefined,
          gst_number: s.gst_number as string | undefined,
          tan_number: s.tan_number as string | undefined,
          phone:      s.phone      as string | undefined,
        })
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
    const lopDays = Math.max(0, payslip.working_days - Number(payslip.present_days))
    const co = orgInfo
    const netWords = numberToWords(payslip.net_salary)

    const logoHtml = co.logo_url
      ? `<img src="${co.logo_url}" style="height:60px;width:auto;object-fit:contain" />`
      : `<img src="/axiotta-hrms.png" style="height:60px;width:auto;object-fit:contain" />`

    const metaParts = [
      co.phone      ? `Tel: ${co.phone}`          : '',
      co.gst_number ? `GSTIN: ${co.gst_number}`   : '',
      co.tan_number ? `TAN: ${co.tan_number}`      : '',
    ].filter(Boolean).join(' &nbsp;|&nbsp; ')

    // Zip earnings & deductions side-by-side
    const earningsArr = Object.entries(payslip.earnings)
    const deductionsArr = Object.entries(payslip.deductions)
    const maxRows = Math.max(earningsArr.length, deductionsArr.length)
    const combinedRows = Array.from({ length: maxRows }, (_, i) => {
      const [el, ea] = earningsArr[i] ?? ['', null]
      const [dl, da] = deductionsArr[i] ?? ['', null]
      return `<tr>
        <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px">${el}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px;text-align:right;border-right:2px solid #999">${ea !== null ? fmt(ea as number) : ''}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px">${dl}</td>
        <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px;text-align:right">${da !== null ? fmt(da as number) : ''}</td>
      </tr>`
    }).join('')

    const doiStr = emp.date_of_joining
      ? new Date(emp.date_of_joining).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
      : '—'

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Payslip — ${emp.first_name} ${emp.last_name} — ${monthLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; }
    .page { width: 210mm; margin: 0 auto; padding: 12mm; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #bbb; padding: 5px 8px; }
    .hdr { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #1a3a6b; padding-bottom: 10px; margin-bottom: 10px; }
    .co-name { font-size: 18px; font-weight: bold; text-transform: uppercase; color: #1a3a6b; }
    .co-meta { font-size: 10px; color: #444; margin-top: 3px; }
    .banner { background: #1a3a6b; color: #fff; text-align: center; padding: 6px 8px; font-size: 13px; font-weight: bold; letter-spacing: 1.5px; margin-bottom: 10px; }
    .lbl { background: #eef2f8; color: #555; font-size: 10px; font-weight: normal; }
    .val { font-size: 11px; }
    .sec-hdr { background: #dce6f1; font-weight: bold; font-size: 11px; text-align: center; letter-spacing: 0.5px; }
    .col-hdr { background: #f0f4fb; font-size: 10px; font-weight: bold; text-align: center; }
    tfoot td { font-weight: bold; background: #eef2f8; border-top: 2px solid #1a3a6b; font-size: 11px; }
    .net-wrap { border: 2px solid #1a3a6b; margin: 10px 0; }
    .net-title { background: #1a3a6b; color: #fff; font-weight: bold; font-size: 12px; text-align: center; padding: 8px; letter-spacing: 1px; }
    .net-amount { font-size: 24px; font-weight: bold; color: #1a3a6b; text-align: right; padding: 8px 16px; }
    .net-words { font-size: 10px; color: #444; font-style: italic; padding: 4px 12px 8px; }
    .footer { border-top: 1px solid #bbb; padding-top: 10px; margin-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-note { font-size: 10px; color: #666; font-style: italic; }
    .sign { text-align: right; font-size: 10px; color: #555; }
    @media print { body { margin: 0; } .page { padding: 10mm; } button { display: none !important; } }
  </style>
</head>
<body>
<div class="page">
  <button onclick="window.print()" style="float:right;padding:6px 16px;background:#1a3a6b;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:10px">🖨 Print / Save PDF</button>

  <!-- Company Header -->
  <div class="hdr">
    ${logoHtml}
    <div style="flex:1;text-align:center">
      <div class="co-name">${co.name || 'Company'}</div>
      ${co.address ? `<div class="co-meta">${co.address}</div>` : ''}
      ${metaParts ? `<div class="co-meta">${metaParts}</div>` : ''}
    </div>
  </div>

  <!-- Pay Slip Banner -->
  <div class="banner">PAY SLIP FOR THE MONTH OF ${monthLabel.toUpperCase()}</div>

  <!-- Employee Info -->
  <table style="margin-bottom:10px">
    <tbody>
      <tr>
        <td class="lbl" style="width:20%">Employee Code</td>
        <td class="val" style="width:30%">${emp.emp_code}</td>
        <td class="lbl" style="width:20%">Department</td>
        <td class="val" style="width:30%">${emp.department?.name ?? '—'}</td>
      </tr>
      <tr>
        <td class="lbl">Employee Name</td>
        <td class="val" style="font-weight:bold">${emp.first_name} ${emp.last_name}</td>
        <td class="lbl">Designation</td>
        <td class="val">${emp.designation?.name ?? '—'}</td>
      </tr>
      <tr>
        <td class="lbl">Date of Joining</td>
        <td class="val">${doiStr}</td>
        <td class="lbl">Pay Period</td>
        <td class="val">${monthLabel}</td>
      </tr>
    </tbody>
  </table>

  <!-- Attendance Summary -->
  <table style="margin-bottom:10px">
    <thead>
      <tr>
        <th class="sec-hdr" colspan="5">ATTENDANCE SUMMARY</th>
      </tr>
      <tr>
        <th class="col-hdr">Days in Month</th>
        <th class="col-hdr">Days Paid</th>
        <th class="col-hdr">Days Present</th>
        <th class="col-hdr">Week Off / Holidays</th>
        <th class="col-hdr">LWP / Absent</th>
      </tr>
    </thead>
    <tbody>
      <tr style="text-align:center">
        <td>${payslip.working_days}</td>
        <td>${payslip.present_days}</td>
        <td>${payslip.present_days}</td>
        <td>—</td>
        <td>${lopDays}</td>
      </tr>
    </tbody>
  </table>

  <!-- Earnings & Deductions -->
  <table style="margin-bottom:10px">
    <thead>
      <tr>
        <th class="sec-hdr" colspan="2" style="border-right:2px solid #999">EARNINGS</th>
        <th class="sec-hdr" colspan="2">DEDUCTIONS</th>
      </tr>
      <tr>
        <th class="col-hdr" style="width:30%">Component</th>
        <th class="col-hdr" style="width:20%;text-align:right;border-right:2px solid #999">Amount</th>
        <th class="col-hdr" style="width:30%">Component</th>
        <th class="col-hdr" style="width:20%;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${combinedRows}</tbody>
    <tfoot>
      <tr>
        <td style="border:1px solid #bbb">Total Earnings</td>
        <td style="border:1px solid #bbb;text-align:right;border-right:2px solid #999">${fmt(payslip.gross_salary)}</td>
        <td style="border:1px solid #bbb">Total Deductions</td>
        <td style="border:1px solid #bbb;text-align:right">${fmt(payslip.total_deductions)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Net Pay -->
  <div class="net-wrap">
    <div style="display:flex;align-items:center">
      <div class="net-title" style="width:35%;padding:12px">NET PAY</div>
      <div class="net-amount" style="flex:1">${fmt(payslip.net_salary)}</div>
    </div>
    <div class="net-words">Amount in Words: ${netWords}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p class="footer-note">This is a Computer Generated Payslip and does not require a signature.</p>
    <div class="sign">
      <div style="margin-bottom:24px">&nbsp;</div>
      <div>Authorised Signatory</div>
    </div>
  </div>
</div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) { toast.error('Please allow popups'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 600)
    toast.success('Opening payslip for download')
  }

  const monthOptions = payslips.map(p => ({
    id: p.id,
    label: `${monthNames[p.month - 1]} ${p.year}`,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print styles */}
      <style>{`
        @media print {
          header, .no-print { display: none !important; }
          body { background: white; }
          #payslip-card { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Top Nav */}
      <header className="no-print sticky top-0 z-30 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <img src="/axiotta-hrms.png" alt="Axiotta HRMS" className="h-7 w-auto object-contain" />
          <span className="text-sm text-gray-500">
            {payslip ? `${payslip.employee.first_name} ${payslip.employee.last_name}` : 'Loading...'}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        <p className="text-xs text-gray-400 no-print">
          Home &rsaquo; Payroll &rsaquo; <span className="text-gray-700 font-medium">Payslip</span>
        </p>

        {/* Controls */}
        <div className="flex items-center justify-between no-print">
          <h1 className="text-2xl font-bold">Payslip</h1>
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
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !payslip ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-sm">No payslips available yet.</p>
            <p className="text-xs mt-1">Ask your HR admin to run and approve payroll.</p>
          </div>
        ) : (
          <div
            id="payslip-card"
            className="bg-white shadow-md rounded-md overflow-hidden border border-gray-200"
          >
            {/* Company Header */}
            <div className="flex items-center gap-4 px-8 py-5 border-b-2 border-[#1a3a6b]">
              {orgInfo.logo_url
                ? <img src={orgInfo.logo_url} alt="Logo" className="h-14 w-auto object-contain" />
                : <img src="/axiotta-hrms.png" alt="Logo" className="h-14 w-auto object-contain" />
              }
              <div className="flex-1 text-center">
                <h2 className="text-xl font-bold uppercase text-[#1a3a6b]">
                  {orgInfo.name || 'Company'}
                </h2>
                {orgInfo.address && (
                  <p className="text-xs text-gray-500 mt-0.5">{orgInfo.address}</p>
                )}
                {(orgInfo.phone || orgInfo.gst_number || orgInfo.tan_number) && (
                  <p className="text-xs text-gray-500">
                    {[
                      orgInfo.phone      ? `Tel: ${orgInfo.phone}`         : '',
                      orgInfo.gst_number ? `GSTIN: ${orgInfo.gst_number}`  : '',
                      orgInfo.tan_number ? `TAN: ${orgInfo.tan_number}`    : '',
                    ].filter(Boolean).join('  |  ')}
                  </p>
                )}
              </div>
            </div>

            {/* Pay Slip Banner */}
            <div className="bg-[#1a3a6b] text-white text-center py-2 text-sm font-bold tracking-widest">
              PAY SLIP FOR THE MONTH OF {monthNames[payslip.month - 1].toUpperCase()} {payslip.year}
            </div>

            <div className="p-6 space-y-5">
              {/* Employee Info */}
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 text-gray-500 text-xs px-3 py-2 w-[22%]">Employee Code</td>
                    <td className="border border-gray-300 px-3 py-2 w-[28%]">{payslip.employee.emp_code}</td>
                    <td className="border border-gray-300 bg-gray-50 text-gray-500 text-xs px-3 py-2 w-[22%]">Department</td>
                    <td className="border border-gray-300 px-3 py-2 w-[28%]">{payslip.employee.department?.name ?? '—'}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 text-gray-500 text-xs px-3 py-2">Employee Name</td>
                    <td className="border border-gray-300 px-3 py-2 font-semibold">{payslip.employee.first_name} {payslip.employee.last_name}</td>
                    <td className="border border-gray-300 bg-gray-50 text-gray-500 text-xs px-3 py-2">Designation</td>
                    <td className="border border-gray-300 px-3 py-2">{payslip.employee.designation?.name ?? '—'}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 bg-gray-50 text-gray-500 text-xs px-3 py-2">Date of Joining</td>
                    <td className="border border-gray-300 px-3 py-2">
                      {payslip.employee.date_of_joining
                        ? new Date(payslip.employee.date_of_joining).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
                        : '—'}
                    </td>
                    <td className="border border-gray-300 bg-gray-50 text-gray-500 text-xs px-3 py-2">Pay Period</td>
                    <td className="border border-gray-300 px-3 py-2">{monthNames[payslip.month - 1]} {payslip.year}</td>
                  </tr>
                </tbody>
              </table>

              {/* Attendance Summary */}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th colSpan={5} className="border border-gray-300 bg-[#dce6f1] text-center font-bold text-xs py-2 tracking-wide">
                      ATTENDANCE SUMMARY
                    </th>
                  </tr>
                  <tr>
                    {['Days in Month','Days Paid','Days Present','Week Off / Holidays','LWP / Absent'].map(h => (
                      <th key={h} className="border border-gray-300 bg-gray-50 text-gray-500 text-xs font-semibold text-center px-2 py-1.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-center">
                    <td className="border border-gray-300 py-2">{payslip.working_days}</td>
                    <td className="border border-gray-300 py-2">{payslip.present_days}</td>
                    <td className="border border-gray-300 py-2">{payslip.present_days}</td>
                    <td className="border border-gray-300 py-2">—</td>
                    <td className="border border-gray-300 py-2">{Math.max(0, payslip.working_days - Number(payslip.present_days))}</td>
                  </tr>
                </tbody>
              </table>

              {/* Earnings & Deductions */}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th colSpan={2} className="border border-gray-300 bg-[#dce6f1] text-center font-bold text-xs py-2 tracking-wide border-r-2 border-r-gray-500">EARNINGS</th>
                    <th colSpan={2} className="border border-gray-300 bg-[#dce6f1] text-center font-bold text-xs py-2 tracking-wide">DEDUCTIONS</th>
                  </tr>
                  <tr>
                    <th className="border border-gray-300 bg-gray-50 text-gray-500 text-xs font-semibold px-3 py-1.5 w-[30%]">Component</th>
                    <th className="border border-gray-300 bg-gray-50 text-gray-500 text-xs font-semibold px-3 py-1.5 text-right w-[20%] border-r-2 border-r-gray-500">Amount</th>
                    <th className="border border-gray-300 bg-gray-50 text-gray-500 text-xs font-semibold px-3 py-1.5 w-[30%]">Component</th>
                    <th className="border border-gray-300 bg-gray-50 text-gray-500 text-xs font-semibold px-3 py-1.5 text-right w-[20%]">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const earningsArr = Object.entries(payslip.earnings)
                    const deductionsArr = Object.entries(payslip.deductions)
                    const maxRows = Math.max(earningsArr.length, deductionsArr.length)
                    return Array.from({ length: maxRows }, (_, i) => {
                      const [el, ea] = earningsArr[i] ?? ['', null]
                      const [dl, da] = deductionsArr[i] ?? ['', null]
                      return (
                        <tr key={i}>
                          <td className="border border-gray-200 px-3 py-2">{el}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right border-r-2 border-r-gray-400">{ea !== null ? fmt(ea) : ''}</td>
                          <td className="border border-gray-200 px-3 py-2">{dl}</td>
                          <td className="border border-gray-200 px-3 py-2 text-right">{da !== null ? fmt(da) : ''}</td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2.5 font-bold bg-gray-100">Total Earnings</td>
                    <td className="border border-gray-300 px-3 py-2.5 font-bold bg-gray-100 text-right border-r-2 border-r-gray-500">{fmt(payslip.gross_salary)}</td>
                    <td className="border border-gray-300 px-3 py-2.5 font-bold bg-gray-100">Total Deductions</td>
                    <td className="border border-gray-300 px-3 py-2.5 font-bold bg-gray-100 text-right">{fmt(payslip.total_deductions)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Net Pay */}
              <div className="border-2 border-[#1a3a6b] overflow-hidden">
                <div className="flex items-center">
                  <div className="bg-[#1a3a6b] text-white font-bold text-sm text-center py-3 px-4" style={{ width: '35%' }}>
                    NET PAY
                  </div>
                  <div className="flex-1 text-right text-2xl font-bold text-[#1a3a6b] px-6 py-3">
                    {fmt(payslip.net_salary)}
                  </div>
                </div>
                <div className="border-t border-[#1a3a6b] bg-blue-50 px-4 py-2 text-xs text-gray-600 italic">
                  Amount in Words: {numberToWords(payslip.net_salary)}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end pt-2 border-t border-gray-200 mt-4">
                <p className="text-xs text-gray-500 italic">
                  This is a Computer Generated Payslip and does not require a signature.
                </p>
                <div className="text-right text-xs text-gray-500">
                  <div className="mb-6">&nbsp;</div>
                  <div>Authorised Signatory</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Payslip
