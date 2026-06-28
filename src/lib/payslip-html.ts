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

function cleanEarnings(obj: Record<string, number>) {
  return Object.entries(obj).filter(([k, v]) => v > 0 && k !== 'Adjustment')
}
function cleanDeductions(obj: Record<string, number>) {
  return Object.entries(obj).filter(([k, v]) => v > 0 && !INVALID_DEDUCTION_KEYS.has(k.toLowerCase()))
}

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

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

export interface PayslipData {
  month: number
  year: number
  working_days: number
  present_days: number
  earnings: Record<string, number>
  deductions: Record<string, number>
  net_salary: number
  is_manually_adjusted?: boolean
  original_deductions?: Record<string, number> | null
  employee: {
    emp_code: string
    first_name: string
    last_name: string
    date_of_joining?: string | null
    department?: { name: string } | null
    designation?: { name: string } | null
  }
  statutory?: {
    uan_number?: string | null
    pf_number?: string | null
    pan_number?: string | null
    aadhar_number?: string | null
  } | null
  bank?: {
    bank_name?: string | null
    account_number?: string | null
    ifsc_code?: string | null
  } | null
}

export interface OrgInfo {
  name: string
  logo_url?: string
  address?: string
  gst_number?: string
  tan_number?: string
  phone?: string
}

export function buildPayslipHtml(
  payslip: PayslipData,
  org: OrgInfo,
  options?: { isDraft?: boolean }
): string {
  const emp       = payslip.employee
  const monthLabel = `${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`
  const presentDays = Number(payslip.present_days)
  const fullDays    = Math.floor(presentDays)
  const halfDays    = Math.round((presentDays % 1) * 2)   // 0.5 → 1 half-day event

  // LOP days: derive from the stored Loss of Pay deduction amount and the daily rate
  // (gross / calendar days). This is accurate regardless of shift patterns.
  const deductionsObj = payslip.deductions as Record<string, number>
  const lopAmount     = deductionsObj['Loss of Pay'] ?? 0
  const dailyRate     = payslip.working_days > 0 ? (Number(payslip.net_salary) + lopAmount) / payslip.working_days : 0
  const lopDaysDisplay = (lopAmount > 0 && dailyRate > 0)
    ? +(lopAmount / dailyRate).toFixed(1)
    : 0
  const netWords  = numberToWords(Math.round(payslip.net_salary))
  const doiStr    = emp.date_of_joining
    ? new Date(emp.date_of_joining).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
    : '—'

  const metaParts = [
    org.phone      ? `Tel: ${org.phone}`        : '',
    org.gst_number ? `GSTIN: ${org.gst_number}` : '',
    org.tan_number ? `TAN: ${org.tan_number}`   : '',
  ].filter(Boolean).join(' &nbsp;|&nbsp; ')

  const logoHtml = org.logo_url
    ? `<img src="${org.logo_url}" style="height:60px;width:auto;object-fit:contain" />`
    : `<img src="/lightmodelogo.png" style="height:60px;width:auto;object-fit:contain" />`

  const earningsArr   = cleanEarnings(payslip.earnings)
  const deductionsArr = cleanDeductions(payslip.deductions)
  const totalEarnings   = earningsArr.reduce((s, [,v]) => s + v, 0)
  const totalDeductions = deductionsArr.reduce((s, [,v]) => s + v, 0)
  const maxRows = Math.max(earningsArr.length, deductionsArr.length)

  const combinedRows = Array.from({ length: maxRows }, (_, i) => {
    const [el, ea] = earningsArr[i]   ?? ['', null]
    const [dl, da] = deductionsArr[i] ?? ['', null]
    return `<tr>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px">${el}</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;text-align:right;border-right:2px solid #999">${ea !== null ? fmt(ea) : ''}</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;color:#b91c1c">${dl}</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;text-align:right;color:#b91c1c">${da !== null ? fmt(da) : ''}</td>
    </tr>`
  }).join('')

  // Compute granted amounts: deductions that HR reduced vs what payroll originally calculated.
  // e.g. payroll had LOP=1000, HR sets LOP=0 → granted['Loss of Pay'] = 1000
  const grantedEntries: [string, number][] = []
  if (payslip.is_manually_adjusted && payslip.original_deductions) {
    const origDed  = payslip.original_deductions
    const currDed  = payslip.deductions as Record<string, number>
    for (const [key, origVal] of Object.entries(origDed)) {
      if (INVALID_DEDUCTION_KEYS.has(key.toLowerCase())) continue
      const origAmt = Math.round(origVal ?? 0)
      const currAmt = Math.round(currDed[key] ?? 0)
      if (origAmt > currAmt && origAmt > 0) {
        grantedEntries.push([key, origAmt - currAmt])
      }
    }
  }
  const totalGranted = grantedEntries.reduce((s, [,v]) => s + v, 0)

  const grantedSection = grantedEntries.length > 0 ? `
  <table style="margin-bottom:10px;border:1px solid #bbf7d0;border-radius:2px">
    <thead>
      <tr>
        <th colspan="2" style="background:#dcfce7;color:#166534;font-size:11px;font-weight:bold;text-align:center;padding:6px;letter-spacing:0.5px;border-bottom:1px solid #bbf7d0">
          HR ADJUSTMENTS — CONCESSIONS GRANTED
        </th>
      </tr>
      <tr>
        <th style="background:#f0fdf4;font-size:10px;font-weight:bold;color:#15803d;padding:5px 8px;border-bottom:1px solid #bbf7d0;width:70%">Deduction Waived / Reduced</th>
        <th style="background:#f0fdf4;font-size:10px;font-weight:bold;color:#15803d;padding:5px 8px;text-align:right;border-bottom:1px solid #bbf7d0">Amount Granted</th>
      </tr>
    </thead>
    <tbody>
      ${grantedEntries.map(([label, amount]) => `
        <tr>
          <td style="padding:5px 8px;font-size:11px;border-bottom:1px solid #d1fae5">${label}</td>
          <td style="padding:5px 8px;font-size:11px;text-align:right;color:#15803d;font-weight:bold;border-bottom:1px solid #d1fae5">+${fmt(amount)}</td>
        </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td style="padding:5px 8px;font-size:11px;font-weight:bold;background:#dcfce7;color:#166534">Total Concession</td>
        <td style="padding:5px 8px;font-size:11px;font-weight:bold;text-align:right;background:#dcfce7;color:#166534">+${fmt(totalGranted)}</td>
      </tr>
    </tfoot>
  </table>` : ''

  const statutoryRows = (payslip.statutory || payslip.bank) ? `
  <tr>
    <td class="lbl">UAN No.</td>
    <td class="val">${payslip.statutory?.uan_number ?? '—'}</td>
    <td class="lbl">PF No.</td>
    <td class="val">${payslip.statutory?.pf_number ?? '—'}</td>
  </tr>
  <tr>
    <td class="lbl">PAN No.</td>
    <td class="val">${payslip.statutory?.pan_number ?? '—'}</td>
    <td class="lbl">Aadhaar No.</td>
    <td class="val">${payslip.statutory?.aadhar_number ?? '—'}</td>
  </tr>
  ${payslip.bank ? `<tr>
    <td class="lbl">Bank</td>
    <td class="val">${payslip.bank.bank_name ?? '—'}${payslip.bank.ifsc_code ? ` (${payslip.bank.ifsc_code})` : ''}</td>
    <td class="lbl">Account No.</td>
    <td class="val">${payslip.bank.account_number ?? '—'}</td>
  </tr>` : ''}` : ''

  const draftBanner = options?.isDraft
    ? `<div style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 16px;margin-bottom:10px;text-align:center;font-size:12px;font-weight:bold;color:#92400e">⚠ DRAFT — This payslip has not been approved yet and is subject to change</div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Payslip — ${emp.first_name} ${emp.last_name} — ${monthLabel}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff}
  .page{width:210mm;margin:0 auto;padding:12mm}
  table{width:100%;border-collapse:collapse}
  .hdr{display:flex;align-items:center;gap:16px;border-bottom:2px solid #1a3a6b;padding-bottom:10px;margin-bottom:10px}
  .co-name{font-size:18px;font-weight:bold;text-transform:uppercase;color:#1a3a6b}
  .co-meta{font-size:10px;color:#444;margin-top:3px}
  .banner{background:#1a3a6b;color:#fff;text-align:center;padding:7px 8px;font-size:13px;font-weight:bold;letter-spacing:1.5px;margin-bottom:10px}
  .lbl{background:#eef2f8;color:#555;font-size:10px;font-weight:normal;border:1px solid #bbb;padding:5px 8px;width:20%}
  .val{font-size:11px;border:1px solid #bbb;padding:5px 8px;width:30%}
  .sec-hdr{background:#dce6f1;font-weight:bold;font-size:11px;text-align:center;letter-spacing:0.5px;border:1px solid #bbb;padding:6px}
  .col-hdr{background:#f0f4fb;font-size:10px;font-weight:bold;text-align:center;border:1px solid #bbb;padding:5px 8px}
  .net-wrap{border:2px solid #1a3a6b;margin:10px 0;border-radius:2px}
  .net-title{background:#1a3a6b;color:#fff;font-weight:bold;font-size:12px;text-align:center;padding:10px;letter-spacing:1px}
  .net-amt{font-size:26px;font-weight:bold;color:#1a3a6b;text-align:right;padding:8px 20px}
  .net-words{font-size:10px;color:#444;font-style:italic;padding:5px 12px 8px;border-top:1px solid #c8d8f0;background:#f5f8ff}
  .footer{border-top:1px solid #bbb;padding-top:10px;margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end}
  .footer-note{font-size:10px;color:#666;font-style:italic}
  @media print{body{margin:0}.page{padding:10mm}button{display:none!important}}
</style>
</head>
<body>
<div class="page">
<button onclick="window.print()" style="float:right;padding:6px 16px;background:#1a3a6b;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-bottom:10px">🖨 Print / Save PDF</button>

${draftBanner}

<div class="hdr">
  ${logoHtml}
  <div style="flex:1;text-align:center">
    <div class="co-name">${org.name || 'Company'}</div>
    ${org.address ? `<div class="co-meta">${org.address}</div>` : ''}
    ${metaParts   ? `<div class="co-meta">${metaParts}</div>`   : ''}
  </div>
</div>

<div class="banner">PAY SLIP FOR THE MONTH OF ${monthLabel.toUpperCase()}</div>

<table style="margin-bottom:10px"><tbody>
  <tr>
    <td class="lbl">Employee Code</td><td class="val">${emp.emp_code}</td>
    <td class="lbl">Department</td><td class="val">${emp.department?.name ?? '—'}</td>
  </tr>
  <tr>
    <td class="lbl">Employee Name</td><td class="val" style="font-weight:bold">${emp.first_name} ${emp.last_name}</td>
    <td class="lbl">Designation</td><td class="val">${emp.designation?.name ?? '—'}</td>
  </tr>
  <tr>
    <td class="lbl">Date of Joining</td><td class="val">${doiStr}</td>
    <td class="lbl">Pay Period</td><td class="val">${monthLabel}</td>
  </tr>
  ${statutoryRows}
</tbody></table>

<table style="margin-bottom:10px">
  <thead>
    <tr><th class="sec-hdr" colspan="5">ATTENDANCE SUMMARY</th></tr>
    <tr>
      <th class="col-hdr">Days in Month</th>
      <th class="col-hdr">Full Days Present</th>
      <th class="col-hdr">Half Days</th>
      <th class="col-hdr">Effective Days Paid</th>
      <th class="col-hdr">LOP Days</th>
    </tr>
  </thead>
  <tbody>
    <tr style="text-align:center;font-size:11px">
      <td style="border:1px solid #bbb;padding:6px">${payslip.working_days}</td>
      <td style="border:1px solid #bbb;padding:6px">${fullDays}</td>
      <td style="border:1px solid #bbb;padding:6px">${halfDays > 0 ? halfDays : '—'}</td>
      <td style="border:1px solid #bbb;padding:6px;font-weight:bold">${presentDays}</td>
      <td style="border:1px solid #bbb;padding:6px;color:${lopDaysDisplay > 0 ? '#b91c1c' : 'inherit'}">${lopDaysDisplay > 0 ? lopDaysDisplay : '—'}</td>
    </tr>
  </tbody>
</table>

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
      <td style="border:1px solid #bbb;padding:6px 8px;font-weight:bold;background:#eef2f8;font-size:11px">Total Earnings</td>
      <td style="border:1px solid #bbb;padding:6px 8px;font-weight:bold;background:#eef2f8;text-align:right;border-right:2px solid #999;font-size:11px">${fmt(totalEarnings)}</td>
      <td style="border:1px solid #bbb;padding:6px 8px;font-weight:bold;background:#eef2f8;font-size:11px">Total Deductions</td>
      <td style="border:1px solid #bbb;padding:6px 8px;font-weight:bold;background:#eef2f8;text-align:right;font-size:11px">${fmt(totalDeductions)}</td>
    </tr>
  </tfoot>
</table>

${grantedSection}

<div class="net-wrap">
  <div style="display:flex;align-items:center">
    <div class="net-title" style="width:35%">NET PAY</div>
    <div class="net-amt" style="flex:1">${fmt(Math.round(payslip.net_salary))}</div>
  </div>
  <div class="net-words">Amount in Words: ${netWords}</div>
</div>

<div class="footer">
  <p class="footer-note">This is a Computer Generated Payslip and does not require a signature.</p>
  <div style="text-align:right;font-size:10px;color:#555">
    <div style="margin-bottom:28px">&nbsp;</div>
    <div style="border-top:1px solid #aaa;padding-top:4px;padding-inline:16px">Authorised Signatory</div>
  </div>
</div>
</div>
</body>
</html>`
}
