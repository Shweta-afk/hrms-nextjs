import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── Month name → 0-indexed month number ────────────────────────────────────
const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function parseHHMM(val: string): number {
  // Returns total minutes from "HH:MM" or "HH:MM:SS"
  if (!val || val === '00:00' || val === '00:00:00') return 0
  const parts = val.replace(/[^0-9:]/g, '').split(':')
  const h = parseInt(parts[0] ?? '0', 10) || 0
  const m = parseInt(parts[1] ?? '0', 10) || 0
  return h * 60 + m
}

function parseHHMMtoHours(val: string): number {
  return parseHHMM(val) / 60
}

function cleanTime(val: string): string | null {
  // Strips "(SE)" suffix, leading/trailing spaces
  const clean = val.replace(/\(SE\)/gi, '').trim()
  if (!clean || clean === '00:00' || clean === '00:00:00') return null
  return clean
}

// Combine a UTC date with a HH:MM:SS time string into a proper DateTime.
// The device records IST (UTC+5:30); we store as UTC by subtracting the offset.
function toDateTime(dateUtc: Date, timeStr: string | null): Date | null {
  if (!timeStr) return null
  const parts = timeStr.split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parseInt(parts[1] ?? '0', 10)
  const s = parseInt(parts[2] ?? '0', 10)
  if (isNaN(h) || isNaN(m) || isNaN(s)) return null
  // Copy the date, set time in UTC treating device local time as IST (UTC+5:30)
  const dt = new Date(dateUtc)
  dt.setUTCHours(h - 5, m - 30, s, 0)
  return dt
}

// Parse "21-Apr-2026 to 20-May-2026" → { startDay, startMonth, startYear, endDay, endMonth, endYear }
function parseDateRange(rangeStr: string) {
  const parts = rangeStr.trim().split(/\s+to\s+/i)
  if (parts.length !== 2) return null
  const parse = (s: string) => {
    const m = s.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
    if (!m) return null
    return { day: parseInt(m[1]), month: MONTH_MAP[m[2].toLowerCase()], year: parseInt(m[3]) }
  }
  const start = parse(parts[0])
  const end   = parse(parts[1])
  if (!start || !end) return null
  return { start, end }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 })

    const text = await file.text()
    const allLines = text.split(/\r?\n/)

    // ── 1. Parse date range from row 3 (index 2) ───────────────────────────
    // Row format: "21-Apr-2026 to 20-May-2026,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,"
    const dateRangeLine = allLines[2] ?? ''
    const dateRangeCells = dateRangeLine.split(',')
    const rangeStr = dateRangeCells[0] // first cell has the range
    const dateRange = parseDateRange(rangeStr)

    if (!dateRange) {
      return NextResponse.json(
        { success: false, error: `Could not parse date range from row 3: "${rangeStr}". Expected format: "21-Apr-2026 to 20-May-2026"` },
        { status: 400 }
      )
    }

    const { start, end } = dateRange
    // Payroll month = end date's month (1-indexed)
    const payrollMonth = end.month + 1
    const payrollYear  = end.year

    // Period boundaries for holiday lookup
    const periodStart = new Date(Date.UTC(start.year, start.month, start.day))
    const periodEnd   = new Date(Date.UTC(end.year,   end.month,   end.day, 23, 59, 59))

    // ── 2. Load existing employees for this org ─────────────────────────────
    const existingEmployees = await prisma.employee.findMany({
      where: { org_id: session.user.org_id, status: 'active' },
      select: { id: true, emp_code: true, email: true, first_name: true, last_name: true },
    })
    const empMap = new Map<string, { id: string; emp_code: string; email: string; first_name: string; last_name: string }>(
      existingEmployees.map(e => [e.emp_code.toUpperCase(), e])
    )

    // ── 3. Pull org settings, name, and holidays for the period ────────────
    const org = await prisma.organisation.findUnique({
      where: { id: session.user.org_id },
      select: { name: true, settings: true },
    })
    const orgName = org?.name ?? 'Company'
    const settings = (org?.settings ?? {}) as Record<string, unknown>

    // Weekly offs from org settings (0=Sun,6=Sat). Default: Sun+Sat.
    const workWeekDays = (settings.work_week_days as number) ?? 5
    const weeklyOffs: number[] = Array.isArray(settings.weekly_offs)
      ? (settings.weekly_offs as number[])
      : workWeekDays >= 6 ? [0] : [0, 6]

    // Load holidays in the period (Set of YYYY-MM-DD strings)
    const holidays = await prisma.holiday.findMany({
      where: { org_id: session.user.org_id, date: { gte: periodStart, lte: periodEnd } },
      select: { date: true, type: true },
    })
    const holidaySet = new Set<string>()       // dates that are holidays (not working_day overrides)
    const workingDaySet = new Set<string>()    // holiday-overrides that ARE working days
    for (const h of holidays) {
      const ds = new Date(h.date).toISOString().slice(0, 10)
      if (h.type === 'working_day') workingDaySet.add(ds)
      else holidaySet.add(ds)
    }

    // Determine the correct status for a date when the device shows 'A'
    function resolveAbsentStatus(date: Date): string {
      const ds = date.toISOString().slice(0, 10)
      if (workingDaySet.has(ds)) return 'absent'   // org said this day IS working
      if (holidaySet.has(ds))    return 'holiday'
      if (weeklyOffs.includes(date.getUTCDay())) return 'weekly_off'
      return 'absent'
    }

    // ── 4. Parse employee blocks ─────────────────────────────────────────────
    type ImportedEmp = {
      emp_code: string; name: string; employee_id: string;
      email: string | null; is_new: boolean;
      present: number; absent: number; late: number; records_saved: number
    }

    let totalRecordsSaved = 0
    let totalEmployeesCreated = 0
    const importedEmployees: ImportedEmp[] = []

    let i = 0
    while (i < allLines.length) {
      const line = allLines[i]
      const cells = line.split(',')

      // Detect employee block header: first cell is "EmployeeCode " (with or without trailing space)
      if (!cells[0].trim().startsWith('EmployeeCode')) { i++; continue }

      // ── Extract code & name ──
      const empCode = (cells[7] ?? '').trim()
      const empName = (cells[19] ?? '').trim()
      if (!empCode) { i++; continue }

      const displayName = (empName && empName !== empCode) ? empName : ''
      const firstName = displayName ? (displayName.split(' ')[0] ?? displayName) : 'Employee'
      const lastName  = displayName ? (displayName.split(' ').slice(1).join(' ') || empCode) : empCode

      // ── Fetch or create employee ──
      let employeeId: string
      let isNew = false
      const existing = empMap.get(empCode.toUpperCase())

      if (existing) {
        employeeId = existing.id
      } else {
        // Auto-create — use a placeholder email so the NOT NULL constraint is satisfied
        const placeholderEmail = `${empCode.toLowerCase()}@imported.local`
        const newEmp = await prisma.employee.create({
          data: {
            org_id:          session.user.org_id,
            emp_code:        empCode,
            first_name:      firstName,
            last_name:       lastName,
            email:           placeholderEmail,
            employment_type: 'full_time',
            status:          'active',
            date_of_joining: new Date(),
          },
        })
        employeeId = newEmp.id
        empMap.set(empCode.toUpperCase(), { id: newEmp.id, emp_code: empCode, email: placeholderEmail, first_name: firstName, last_name: lastName })
        isNew = true
        totalEmployeesCreated++
      }

      // ── Advance to date-header row (next row after EmployeeCode) ──
      i++
      const dateHeaderLine = allLines[i] ?? ''
      const dateCols = dateHeaderLine.split(',')
      // dateCols[0] is empty, dateCols[1..n] are "21-Tue","22-Wed", etc.

      // Build column-index → actual Date map
      const colToDate: Map<number, Date> = new Map()
      for (let col = 1; col < dateCols.length; col++) {
        const cell = dateCols[col].trim()
        if (!cell) continue
        const dayMatch = cell.match(/^(\d{1,2})-/)
        if (!dayMatch) continue
        const day = parseInt(dayMatch[1], 10)
        // If day >= start.day → start month/year, else → end month/year
        const mon  = day >= start.day ? start.month : end.month
        const yr   = day >= start.day ? start.year  : end.year
        colToDate.set(col, new Date(Date.UTC(yr, mon, day)))
      }

      // ── Advance past Summary / Shift rows to In Time ──
      // We scan for specific row labels
      let statusCols:  string[] = []
      let lateByMins:  number[] = []
      let otHours:     number[] = []
      let inTimeCols:  string[] = []
      let outTimeCols: string[] = []
      const maxRows = 12 // employee block has at most ~10 data rows

      for (let r = 0; r < maxRows; r++) {
        i++
        const rowLine  = allLines[i] ?? ''
        const rowCells = rowLine.split(',')
        const label    = rowCells[0].trim()

        if (label === 'Status') {
          statusCols = rowCells
        } else if (label === 'Late By') {
          lateByMins = rowCells.map((v, idx) => idx === 0 ? 0 : parseHHMM(v))
        } else if (label === 'Total OT') {
          otHours = rowCells.map((v, idx) => idx === 0 ? 0 : parseHHMMtoHours(v))
        } else if (label === 'In Time') {
          inTimeCols = rowCells
        } else if (label === 'Out Time') {
          outTimeCols = rowCells
        } else if (label === '' && statusCols.length > 0) {
          // Blank separator — end of this employee's block
          break
        }
      }

      if (statusCols.length === 0) { i++; continue }

      // ── Write attendance records ──
      let presentCount = 0; let absentCount = 0; let lateCount = 0; let saved = 0

      for (const [col, actualDate] of colToDate) {
        const rawStatus = (statusCols[col] ?? '').trim().toUpperCase()
        if (!rawStatus) continue

        const late        = lateByMins[col] ?? 0
        const ot          = otHours[col] ?? 0
        const inTime      = toDateTime(actualDate, cleanTime(inTimeCols[col] ?? ''))
        const outTime     = toDateTime(actualDate, cleanTime(outTimeCols[col] ?? ''))

        let status: string
        if (rawStatus === 'P') {
          if (late > 0) { status = 'late'; lateCount++ }
          else          { status = 'present' }
          presentCount++
        } else {
          // Cross-check against org holidays & weekly offs so holidays
          // don't count as LOP in payroll reports.
          status = resolveAbsentStatus(actualDate)
          if (status === 'absent') absentCount++
        }

        await prisma.attendanceRecord.upsert({
          where: {
            org_id_employee_id_date: {
              org_id: session.user.org_id,
              employee_id: employeeId,
              date: actualDate,
            },
          },
          update: {
            status,
            is_late:          late > 0,
            late_by_minutes:  late,
            ...(ot > 0  && { overtime_hours: ot }),
            ...(inTime  && { first_in: inTime }),
            ...(outTime && { last_out: outTime }),
            source:           'monthly_details_csv',
          },
          create: {
            org_id:          session.user.org_id,
            employee_id:     employeeId,
            date:            actualDate,
            status,
            is_late:         late > 0,
            late_by_minutes: late,
            ...(ot > 0  && { overtime_hours: ot }),
            ...(inTime  && { first_in: inTime }),
            ...(outTime && { last_out: outTime }),
            source:          'monthly_details_csv',
          },
        })
        saved++
      }

      totalRecordsSaved += saved
      const empInfo = empMap.get(empCode.toUpperCase())
      const emailVal = empInfo?.email ?? null
      const hasRealEmail = emailVal && !emailVal.endsWith('@imported.local')
      importedEmployees.push({
        emp_code:    empCode,
        name:        displayName || `Employee ${empCode}`,
        employee_id: employeeId,
        email:       hasRealEmail ? emailVal : null,
        is_new:      isNew,
        present:     presentCount,
        absent:      absentCount,
        late:        lateCount,
        records_saved: saved,
      })

      i++ // move past blank separator
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Imported ${totalRecordsSaved} records for ${importedEmployees.length} employees (${totalEmployeesCreated} new)`,
        payroll_month:  payrollMonth,
        payroll_year:   payrollYear,
        imported_month: payrollMonth,
        imported_year:  payrollYear,
        date_range:     `${rangeStr}`,
        employees_total:   importedEmployees.length,
        employees_created: totalEmployeesCreated,
        records_saved:     totalRecordsSaved,
        employees:         importedEmployees,
        org_name:          orgName,
      },
    })
  } catch (error) {
    console.error('import_monthly_details_failed', error)
    const msg = error instanceof Error ? error.message : 'Import failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
