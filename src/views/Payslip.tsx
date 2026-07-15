'use client'

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { buildPayslipHtml } from "@/lib/payslip-html";

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
    bank_details?: { bank_name?: string; account_number?: string; ifsc_code?: string } | null;
    statutory_info_decrypted?: { pan_number?: string; uan_number?: string; pf_number?: string; aadhar_number?: string } | null;
  };
  payroll_run: { month: number; year: number; status: string };
  is_manually_adjusted: boolean;
  original_earnings: Record<string, number> | null;
  original_deductions: Record<string, number> | null;
}

interface OrgInfo {
  name: string;
  logo_url?: string;
  address?: string;
  gst_number?: string;
  tan_number?: string;
  phone?: string;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const INVALID_DEDUCTION_KEYS = new Set([
  'net salary','to be credited','total salary','actual salary','per day',
  'actual half day','half day for late mark','deductions if any',
  'previous salary add','salary days','total days','circle count',
  'total late mark','total present','total absent','total half day',
  'total paid leave','total wfh','total hd','adjustment',
])

function cleanEntries(obj: Record<string, number>, isDeduction = false) {
  return Object.entries(obj).filter(([k, v]) => {
    if (!v || v <= 0) return false
    if (isDeduction && INVALID_DEDUCTION_KEYS.has(k.toLowerCase())) return false
    if (!isDeduction && k === 'Adjustment') return false
    return true
  })
}

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

function numberToWords(n: number): string {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  if (n === 0) return 'Zero'
  const convert = (num: number): string => {
    if (num < 20) return ones[num]
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' '+ones[num%10] : '')
    if (num < 1000) return ones[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' '+convert(num%100) : '')
    if (num < 100000) return convert(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' '+convert(num%1000) : '')
    if (num < 10000000) return convert(Math.floor(num/100000)) + ' Lakh' + (num%100000 ? ' '+convert(num%100000) : '')
    return convert(Math.floor(num/10000000)) + ' Crore' + (num%10000000 ? ' '+convert(num%10000000) : '')
  }
  return convert(Math.round(n)) + ' Rupees Only'
}

export default function PayslipPage() {
  const [payslips, setPayslips]   = useState<Payslip[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading]     = useState(true)
  const [orgInfo, setOrgInfo]     = useState<OrgInfo>({ name: '' })

  useEffect(() => {
    ;(async () => {
      try {
        const [slipRes, orgRes] = await Promise.all([
          fetch('/api/payroll/payslips'),
          fetch('/api/org/settings'),
        ])
        const slipJson = await slipRes.json()
        const orgJson  = await orgRes.json()
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
    })()
  }, [])

  const payslip = payslips.find(p => p.id === selectedId)

  const earningsArr   = payslip ? cleanEntries(payslip.earnings, false)   : []
  const deductionsArr = payslip ? cleanEntries(payslip.deductions, true)   : []
  const totalEarnings   = earningsArr.reduce((s, [,v]) => s + v, 0)
  const totalDeductions = deductionsArr.reduce((s, [,v]) => s + v, 0)
  const maxRows = Math.max(earningsArr.length, deductionsArr.length)

  function handlePrint() {
    if (!payslip) return
    const html = buildPayslipHtml(
      {
        ...payslip,
        statutory:            payslip.employee.statutory_info_decrypted ?? undefined,
        bank:                 payslip.employee.bank_details             ?? undefined,
        is_manually_adjusted: payslip.is_manually_adjusted,
        original_deductions:  payslip.original_deductions,
      },
      orgInfo
    )
    const win = window.open('', '_blank')
    if (!win) { toast.error('Please allow popups'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  const monthOptions = payslips.map(p => ({
    id: p.id,
    label: `${MONTH_NAMES[p.month - 1]} ${p.year}`,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`@media print { header,.no-print{display:none!important} body{background:white} #payslip-card{box-shadow:none!important;border:none!important} }`}</style>

      {/* Top Nav */}
      <header className="no-print sticky top-0 z-30 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <img src="/lightmodelogo.webp" alt="HRMS" className="h-7 w-auto object-contain dark:hidden" />
          <img src="/darkmodelogo.webp"  alt="HRMS" className="h-7 w-auto object-contain hidden dark:block" />
          <span className="text-sm text-gray-500">
            {payslip ? `${payslip.employee.first_name} ${payslip.employee.last_name}` : ''}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        <p className="text-xs text-gray-400 no-print">
          Home &rsaquo; Payroll &rsaquo; <span className="text-gray-700 font-medium">Payslip</span>
        </p>

        {/* Controls */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">My Payslips</h1>
            <p className="text-sm text-gray-500 mt-0.5">View and download your salary slips</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedId} onValueChange={setSelectedId} disabled={payslips.length === 0}>
              <SelectTrigger className="w-[180px]">
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
            <Button size="sm" onClick={handlePrint} disabled={!payslip}>
              <Download className="mr-1.5 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading payslips...</p>
          </div>
        ) : !payslip ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="rounded-full bg-gray-100 p-5">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <p className="font-medium text-gray-700">No payslips yet</p>
            <p className="text-sm text-gray-400">Your payslip will appear here once HR approves payroll.</p>
          </div>
        ) : (
          <div id="payslip-card" className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">

            {/* Company Header */}
            <div className="flex items-center gap-4 px-8 py-5 border-b-2 border-[#1a3a6b]">
              {orgInfo.logo_url
                ? <img src={orgInfo.logo_url} alt="Logo" className="h-14 w-auto object-contain" />
                : <img src="/lightmodelogo.png" alt="Logo" className="h-14 w-auto object-contain" />
              }
              <div className="flex-1 text-center">
                <h2 className="text-xl font-bold uppercase text-[#1a3a6b]">{orgInfo.name || 'Company'}</h2>
                {orgInfo.address && <p className="text-xs text-gray-500 mt-0.5">{orgInfo.address}</p>}
                {(orgInfo.phone || orgInfo.gst_number || orgInfo.tan_number) && (
                  <p className="text-xs text-gray-500">
                    {[orgInfo.phone && `Tel: ${orgInfo.phone}`, orgInfo.gst_number && `GSTIN: ${orgInfo.gst_number}`, orgInfo.tan_number && `TAN: ${orgInfo.tan_number}`].filter(Boolean).join('  |  ')}
                  </p>
                )}
              </div>
            </div>

            {/* Banner */}
            <div className="bg-[#1a3a6b] text-white text-center py-2.5 text-sm font-bold tracking-widest">
              PAY SLIP FOR THE MONTH OF {MONTH_NAMES[payslip.month - 1].toUpperCase()} {payslip.year}
            </div>

            <div className="p-6 space-y-5">
              {/* Employee Info */}
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {[
                    ['Employee Code', payslip.employee.emp_code, 'Department', payslip.employee.department?.name ?? '—'],
                    ['Employee Name', <strong>{payslip.employee.first_name} {payslip.employee.last_name}</strong>, 'Designation', payslip.employee.designation?.name ?? '—'],
                    ['Date of Joining', payslip.employee.date_of_joining ? new Date(payslip.employee.date_of_joining).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—', 'Pay Period', `${MONTH_NAMES[payslip.month-1]} ${payslip.year}`],
                  ].map(([l1, v1, l2, v2], i) => (
                    <tr key={i}>
                      <td className="border border-gray-200 bg-gray-50 text-gray-500 text-xs px-3 py-2 w-[22%]">{l1}</td>
                      <td className="border border-gray-200 px-3 py-2 w-[28%]">{v1 as string}</td>
                      <td className="border border-gray-200 bg-gray-50 text-gray-500 text-xs px-3 py-2 w-[22%]">{l2}</td>
                      <td className="border border-gray-200 px-3 py-2 w-[28%]">{v2 as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Attendance Summary */}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th colSpan={5} className="border border-gray-200 bg-[#dce6f1] text-center font-bold text-xs py-2 tracking-wide">
                      ATTENDANCE SUMMARY
                    </th>
                  </tr>
                  <tr>
                    {['Days in Month','Days Paid','Days Present','Week Off / Holidays','LWP / Absent'].map(h => (
                      <th key={h} className="border border-gray-200 bg-gray-50 text-gray-500 text-xs font-semibold text-center px-2 py-1.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-center text-sm">
                    <td className="border border-gray-200 py-2.5">{payslip.working_days}</td>
                    <td className="border border-gray-200 py-2.5">{payslip.present_days}</td>
                    <td className="border border-gray-200 py-2.5">{payslip.present_days}</td>
                    <td className="border border-gray-200 py-2.5">—</td>
                    <td className="border border-gray-200 py-2.5">{Math.max(0, payslip.working_days - Number(payslip.present_days))}</td>
                  </tr>
                </tbody>
              </table>

              {/* Earnings & Deductions */}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th colSpan={2} className="border border-gray-200 bg-[#dce6f1] text-center font-bold text-xs py-2 tracking-wide border-r-2 border-r-gray-400">EARNINGS</th>
                    <th colSpan={2} className="border border-gray-200 bg-[#dce6f1] text-center font-bold text-xs py-2 tracking-wide">DEDUCTIONS</th>
                  </tr>
                  <tr>
                    <th className="border border-gray-200 bg-gray-50 text-gray-500 text-xs font-semibold px-3 py-1.5 w-[30%]">Component</th>
                    <th className="border border-gray-200 bg-gray-50 text-gray-500 text-xs font-semibold px-3 py-1.5 text-right w-[20%] border-r-2 border-r-gray-400">Amount</th>
                    <th className="border border-gray-200 bg-gray-50 text-gray-500 text-xs font-semibold px-3 py-1.5 w-[30%]">Component</th>
                    <th className="border border-gray-200 bg-gray-50 text-gray-500 text-xs font-semibold px-3 py-1.5 text-right w-[20%]">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxRows }, (_, i) => {
                    const [el, ea] = earningsArr[i]   ?? ['', null]
                    const [dl, da] = deductionsArr[i] ?? ['', null]
                    return (
                      <tr key={i}>
                        <td className="border border-gray-200 px-3 py-2">{el}</td>
                        <td className="border border-gray-200 px-3 py-2 text-right border-r-2 border-r-gray-300 tabular-nums">{ea !== null ? fmt(ea) : ''}</td>
                        <td className="border border-gray-200 px-3 py-2 text-red-700">{dl}</td>
                        <td className="border border-gray-200 px-3 py-2 text-right text-red-700 tabular-nums">{da !== null ? fmt(da) : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2.5 font-bold bg-blue-50 text-[#1a3a6b]">Total Earnings</td>
                    <td className="border border-gray-300 px-3 py-2.5 font-bold bg-blue-50 text-right text-[#1a3a6b] border-r-2 border-r-gray-400 tabular-nums">{fmt(totalEarnings)}</td>
                    <td className="border border-gray-300 px-3 py-2.5 font-bold bg-red-50 text-red-700">Total Deductions</td>
                    <td className="border border-gray-300 px-3 py-2.5 font-bold bg-red-50 text-right text-red-700 tabular-nums">{fmt(totalDeductions)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Net Pay */}
              <div className="border-2 border-[#1a3a6b] rounded overflow-hidden">
                <div className="flex items-center">
                  <div className="bg-[#1a3a6b] text-white font-bold text-sm text-center py-3.5 px-4 tracking-widest" style={{ width: '35%' }}>
                    NET PAY
                  </div>
                  <div className="flex-1 text-right text-3xl font-bold text-[#1a3a6b] px-6 py-3 tabular-nums">
                    {fmt(payslip.net_salary)}
                  </div>
                </div>
                <div className="border-t border-[#1a3a6b]/30 bg-blue-50 px-4 py-2 text-xs text-gray-600 italic">
                  Amount in Words: {numberToWords(payslip.net_salary)}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-between items-end pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-400 italic">
                  This is a Computer Generated Payslip and does not require a signature.
                </p>
                <div className="text-right text-xs text-gray-500">
                  <div className="mb-8">&nbsp;</div>
                  <div className="border-t border-gray-400 pt-1 px-4">Authorised Signatory</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
