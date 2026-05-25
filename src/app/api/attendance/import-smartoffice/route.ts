import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function parseDate(d: number, m: number, y: number): Date {
  return new Date(y, m, d)
}

function findPeriod(rows: any[][]): { startDate: Date } | null {
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const rowStr = (rows[i] ?? []).join(' ')
    const m = rowStr.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+[Tt]o/)
    if (m) {
      const mon = MONTH_MAP[m[2].slice(0, 3)]
      if (mon !== undefined) {
        return { startDate: parseDate(parseInt(m[1]), mon, parseInt(m[3])) }
      }
    }
  }
  return null
}

// Build column→Date map from a row of "DD-DDD" labels and a known start date
function buildColDateMap(headerRow: any[], startDate: Date): Map<number, Date> {
  const map = new Map<number, Date>()
  let prevDay = 0
  let year = startDate.getFullYear()
  let month = startDate.getMonth()

  for (let col = 0; col < headerRow.length; col++) {
    const cell = String(headerRow[col] ?? '').trim()
    const m = cell.match(/^(\d{1,2})-[A-Za-z]{2,3}$/)
    if (!m) continue
    const day = parseInt(m[1])
    if (prevDay > 0 && day < prevDay) {
      month++
      if (month > 11) { month = 0; year++ }
    }
    map.set(col, new Date(year, month, day))
    prevDay = day
  }
  return map
}

function parseHHMM(str: string | null | undefined): number {
  const s = String(str ?? '').trim()
  if (!s || s === '00:00' || s === '00:00:00') return 0
  const parts = s.split(':').map(Number)
  if (parts.length < 2 || isNaN(parts[0])) return 0
  return parts[0] + parts[1] / 60
}

function buildDateTime(date: Date, timeStr: string | null | undefined): Date | null {
  const s = String(timeStr ?? '').trim()
  if (!s || s === '00:00:00' || s === '00:00') return null
  const parts = s.split(':').map(Number)
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), parts[0], parts[1], parts[2] ?? 0))
}

interface UpsertData {
  employeeId: string
  date: Date
  status: string
  first_in: Date | null
  last_out: Date | null
  total_hours: number | null
  overtime_hours: number | null
  is_late: boolean
  late_by_minutes: number
  source: string
}

// ─── Monthly Basic ────────────────────────────────────────────────────────────
// Sheet: Monthly_BasicReportForEmployee
// Rows 0-5: headers | Row 6+: emp rows
// Col 1: emp_code | Col 2: name | Col 3+: daily P/A
async function parseMonthlyBasic(
  ws: XLSX.WorkSheet,
  empMap: Map<string, string>,
): Promise<{ records: UpsertData[]; errors: string[] }> {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][]
  const errors: string[] = []
  const records: UpsertData[] = []

  const period = findPeriod(rows)
  if (!period) return { records: [], errors: ['Period not found in Monthly Basic report'] }

  let colDateMap = new Map<number, Date>()
  let dataStart = 6

  for (let i = 0; i < 10; i++) {
    const row = rows[i] ?? []
    const hasDayLabels = row.some(c => /^\d{1,2}-[A-Za-z]{2,3}$/.test(String(c ?? '')))
    if (hasDayLabels) {
      colDateMap = buildColDateMap(row, period.startDate)
      dataStart = i + 2
      break
    }
  }

  if (colDateMap.size === 0) return { records: [], errors: ['Could not parse date columns'] }

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? []
    const empCode = String(row[1] ?? '').trim()
    if (!empCode || /^(S\.?No|EmployeeCode|Total|Sl\.?No)/i.test(empCode)) continue

    const employeeId = empMap.get(empCode)
    if (!employeeId) {
      if (errors.length < 10) errors.push(`Unknown emp code: ${empCode}`)
      continue
    }

    for (const [col, date] of colDateMap) {
      const val = String(row[col] ?? '').trim().toUpperCase()
      if (val !== 'P' && val !== 'A') continue
      records.push({
        employeeId,
        date,
        status: val === 'P' ? 'present' : 'absent',
        first_in: null,
        last_out: null,
        total_hours: null,
        overtime_hours: null,
        is_late: false,
        late_by_minutes: 0,
        source: 'smartoffice_monthly_basic',
      })
    }
  }

  return { records, errors }
}

// ─── Monthly Details ──────────────────────────────────────────────────────────
// Block format: 12 rows per employee
// Block row offsets (0-indexed from block start):
//   0: EmployeeCode: XX, EmployeeName: YY
//   1: date labels
//   2: summary
//   3: Shift
//   4: In Time
//   5: Out Time
//   6: Late By
//   7: Early By
//   8: Total OT
//   9: T Duration
//  10: Status (P/A)
//  11: blank
async function parseMonthlyDetails(
  ws: XLSX.WorkSheet,
  empMap: Map<string, string>,
): Promise<{ records: UpsertData[]; errors: string[] }> {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][]
  const errors: string[] = []
  const records: UpsertData[] = []

  const period = findPeriod(rows)
  if (!period) return { records: [], errors: ['Period not found in Monthly Details report'] }

  for (let i = 0; i < rows.length; i++) {
    const rowStr = (rows[i] ?? []).join(' ')
    if (!rowStr.includes('EmployeeCode:')) continue

    const empRow = rows[i] ?? []
    let empCode = ''
    for (const cell of empRow) {
      const m = String(cell ?? '').match(/EmployeeCode:\s*(\S+)/)
      if (m) { empCode = m[1].trim(); break }
    }
    if (!empCode) continue

    const employeeId = empMap.get(empCode)
    if (!employeeId) {
      if (errors.length < 10) errors.push(`Unknown emp code: ${empCode}`)
      i += 11
      continue
    }

    const dateHeaderRow = rows[i + 1] ?? []
    const colDateMap = buildColDateMap(dateHeaderRow, period.startDate)

    const inRow    = rows[i + 4] ?? []
    const outRow   = rows[i + 5] ?? []
    const lateRow  = rows[i + 6] ?? []
    const otRow    = rows[i + 8] ?? []
    const statRow  = rows[i + 10] ?? []

    for (const [col, date] of colDateMap) {
      const statusStr = String(statRow[col] ?? '').trim().toUpperCase()
      if (statusStr !== 'P' && statusStr !== 'A') continue

      const firstIn = buildDateTime(date, String(inRow[col] ?? ''))
      const lastOut = buildDateTime(date, String(outRow[col] ?? ''))
      const lateByMinutes = Math.round(parseHHMM(String(lateRow[col] ?? '')) * 60)
      const otHours = parseHHMM(String(otRow[col] ?? ''))
      const totalHours = firstIn && lastOut
        ? (lastOut.getTime() - firstIn.getTime()) / 3_600_000
        : null

      records.push({
        employeeId,
        date,
        status: statusStr === 'P' ? 'present' : 'absent',
        first_in: firstIn,
        last_out: lastOut,
        total_hours: totalHours,
        overtime_hours: otHours > 0 ? otHours : null,
        is_late: lateByMinutes > 0,
        late_by_minutes: lateByMinutes,
        source: 'smartoffice_monthly_details',
      })
    }

    i += 11  // advance past this block
  }

  return { records, errors }
}

// ─── Daily Basic ──────────────────────────────────────────────────────────────
// Rows 0-11: metadata | Row 12: column headers | Row 13+: employee data
// Col 2: emp_code | Col 8: InTime | Col 9: OutTime | Col 14: OT | Col 17: Status
async function parseDailyBasic(
  ws: XLSX.WorkSheet,
  empMap: Map<string, string>,
  filename: string,
): Promise<{ records: UpsertData[]; errors: string[] }> {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][]
  const errors: string[] = []
  const records: UpsertData[] = []

  // Find report date from header rows
  let reportDate: Date | null = null
  for (let i = 0; i < 12; i++) {
    const rowStr = (rows[i] ?? []).join(' ')
    const m = rowStr.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/)
    if (m) {
      const mon = MONTH_MAP[m[2].slice(0, 3)]
      if (mon !== undefined) {
        reportDate = parseDate(parseInt(m[1]), mon, parseInt(m[3]))
        break
      }
    }
  }

  // Fall back: parse from filename e.g. "20th May 2026" or "20 May 2026"
  if (!reportDate) {
    const m = filename.match(/(\d{1,2})\s*(?:th|st|nd|rd)?\s*([A-Za-z]+)\s*(\d{4})/i)
    if (m) {
      const mon = MONTH_MAP[m[2].slice(0, 3)]
      if (mon !== undefined) reportDate = parseDate(parseInt(m[1]), mon, parseInt(m[3]))
    }
  }

  if (!reportDate) return { records: [], errors: ['Could not determine report date'] }

  // Find data start row (row after column header row)
  let dataStart = 13
  for (let i = 10; i < 16; i++) {
    const row = rows[i] ?? []
    if (row.some(c => /employeecode/i.test(String(c ?? '')))) {
      dataStart = i + 1
      break
    }
  }

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] ?? []
    const empCode = String(row[2] ?? '').trim()
    if (!empCode || /employeecode/i.test(empCode)) continue

    const employeeId = empMap.get(empCode)
    if (!employeeId) {
      if (errors.length < 10) errors.push(`Unknown emp code: ${empCode}`)
      continue
    }

    const statusStr = String(row[17] ?? '').trim().toUpperCase()
    const status = statusStr === 'P' ? 'present' : 'absent'

    const firstIn = buildDateTime(reportDate, String(row[8] ?? ''))
    const lastOut = buildDateTime(reportDate, String(row[9] ?? ''))
    const otHours = parseHHMM(String(row[14] ?? ''))
    const totalHours = firstIn && lastOut
      ? (lastOut.getTime() - firstIn.getTime()) / 3_600_000
      : null

    let isLate = false
    let lateByMinutes = 0
    if (firstIn) {
      const shiftStart = new Date(firstIn)
      shiftStart.setHours(9, 15, 0, 0)
      if (firstIn > shiftStart) {
        isLate = true
        lateByMinutes = Math.floor((firstIn.getTime() - shiftStart.getTime()) / 60_000)
      }
    }

    records.push({
      employeeId,
      date: reportDate,
      status,
      first_in: firstIn,
      last_out: lastOut,
      total_hours: totalHours,
      overtime_hours: otHours > 0 ? otHours : null,
      is_late: isLate,
      late_by_minutes: lateByMinutes,
      source: 'smartoffice_daily',
    })
  }

  return { records, errors }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer', raw: false })
    const sheetNames = wb.SheetNames
    const filename = file.name

    const employees = await prisma.employee.findMany({
      where: { org_id: session.user.org_id },
      select: { id: true, emp_code: true },
    })
    const empMap = new Map(employees.map(e => [e.emp_code, e.id]))

    let records: UpsertData[] = []
    let errors: string[] = []
    let format = ''
    const fn = filename.toLowerCase()

    if (
      sheetNames.includes('Monthly_BasicReportForEmployee') ||
      (fn.includes('monthly') && fn.includes('basic') && !fn.includes('detail'))
    ) {
      format = 'Monthly Basic'
      const sheet = wb.Sheets[sheetNames.find(n => n.toLowerCase().includes('basic')) ?? sheetNames[0]]
      ;({ records, errors } = await parseMonthlyBasic(sheet, empMap))
    } else if (fn.includes('monthly') && fn.includes('detail')) {
      format = 'Monthly Details'
      ;({ records, errors } = await parseMonthlyDetails(wb.Sheets[sheetNames[0]], empMap))
    } else if (
      sheetNames.some(n => n.toLowerCase().includes('daily')) ||
      fn.includes('daily')
    ) {
      format = 'Daily Basic'
      const sheet = wb.Sheets[sheetNames.find(n => n.toLowerCase().includes('daily')) ?? sheetNames[0]]
      ;({ records, errors } = await parseDailyBasic(sheet, empMap, filename))
    } else {
      return NextResponse.json({ success: false, error: 'Unrecognized Smart Office report format' }, { status: 400 })
    }

    if (records.length === 0 && errors.length > 0) {
      return NextResponse.json({ success: false, error: errors[0] }, { status: 400 })
    }

    let processed = 0
    let skipped = 0

    for (const rec of records) {
      try {
        await prisma.attendanceRecord.upsert({
          where: {
            org_id_employee_id_date: {
              org_id: session.user.org_id,
              employee_id: rec.employeeId,
              date: rec.date,
            },
          },
          update: {
            status: rec.status,
            first_in: rec.first_in,
            last_out: rec.last_out,
            total_hours: rec.total_hours,
            overtime_hours: rec.overtime_hours,
            is_late: rec.is_late,
            late_by_minutes: rec.late_by_minutes,
            source: rec.source,
          },
          create: {
            org_id: session.user.org_id,
            employee_id: rec.employeeId,
            date: rec.date,
            status: rec.status,
            first_in: rec.first_in,
            last_out: rec.last_out,
            total_hours: rec.total_hours,
            overtime_hours: rec.overtime_hours,
            is_late: rec.is_late,
            late_by_minutes: rec.late_by_minutes,
            source: rec.source,
          },
        })
        processed++
      } catch {
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        format,
        processed,
        skipped,
        errors: errors.slice(0, 10),
        message: `${format} import complete — ${processed} records saved`,
      },
    })
  } catch (error) {
    console.error('Smart Office import error:', error)
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 })
  }
}
