import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// XLSX loaded lazily inside handler — keeps cold-start lean
import { format } from 'date-fns'

/**
 * GET /api/reports/attendance/range?from=YYYY-MM-DD&to=YYYY-MM-DD&format=excel|json
 *
 * Wide-format range attendance report — one row per employee, columns
 * span the date range. This is the Smart Office monthly-grid layout and
 * matches how HR reads "at-a-glance who was where this week/month."
 *
 *   Columns:
 *     Sl No · Emp Code · Name · Department · Designation
 *     · [01-Mon] · [02-Tue] · ... · [31-Wed]
 *     · Present · Absent · Late · Half Day · Leave · Holiday
 *     · Weekly Off · WFH · Late Mins · OT Hours
 *
 *   Each date cell:
 *     P / L / HD / A / H / WO / WFH / LV (or leave-type code if known) /
 *     PR  — single-letter codes matching the rest of the system.
 *
 * Employee filter:
 *   `{ status: 'active', exclude_from_payroll: false }`. This report is
 *   for HR's payroll-and-attendance review, so visitors / contractors
 *   excluded from payroll are NOT included by design. The Daily report
 *   shows all active employees if HR needs that broader view.
 *
 * Status priority for each (employee, date) cell:
 *   1. AttendanceRecord present → use its status
 *   2. Approved LeaveRequest covers the date → leave-type code (SL, CL, ...)
 *   3. Date is a Holiday → "H"
 *   4. Saturday or Sunday → "WO"
 *   5. Otherwise → "A"
 *
 * Range capped at 92 days — Excel can comfortably hold 92 date columns
 * plus the summary; the grid stays readable.
 */

// Status code each cell renders. Single character / short codes keep the
// grid scannable when there are 30+ date columns.
const STATUS_CODE: Record<string, string> = {
  present:        'P',
  late:           'L',
  half_day:       'HD',
  wfh:            'WFH',
  pending_review: 'PR',
  leave:          'LV',
  holiday:        'H',
  weekly_off:     'WO',
  weekend:        'WO',
  absent:         'A',
}

export async function GET(req: NextRequest) {
  try {
    const XLSX = await import('xlsx')
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { searchParams } = new URL(req.url)
    const fromStr = searchParams.get('from')
    const toStr   = searchParams.get('to')
    const fmt     = searchParams.get('format') ?? 'excel'

    if (!fromStr || !toStr) {
      return NextResponse.json(
        { success: false, error: 'from and to query parameters are required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const fromParsed = new Date(fromStr)
    const toParsed   = new Date(toStr)
    if (isNaN(fromParsed.getTime()) || isNaN(toParsed.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 })
    }

    // Snap to UTC-midnight to match the @db.Date column comparisons used
    // everywhere else in the codebase.
    const fromUtc = new Date(Date.UTC(
      fromParsed.getFullYear(), fromParsed.getMonth(), fromParsed.getDate()
    ))
    const toUtc = new Date(Date.UTC(
      toParsed.getFullYear(), toParsed.getMonth(), toParsed.getDate()
    ))

    if (fromUtc.getTime() > toUtc.getTime()) {
      return NextResponse.json(
        { success: false, error: '`from` must be on or before `to`' },
        { status: 400 }
      )
    }

    const dayCount = Math.round((toUtc.getTime() - fromUtc.getTime()) / 86_400_000) + 1
    if (dayCount > 92) {
      return NextResponse.json(
        { success: false, error: 'Date range too large (max 92 days). Split the report into smaller windows.' },
        { status: 400 }
      )
    }

    const org_id = session.user.org_id

    // Parallel-load everything. Note the employee filter: payroll-included
    // active employees only.
    const [employees, records, leaves, holidays] = await Promise.all([
      prisma.employee.findMany({
        where: { org_id, status: 'active', exclude_from_payroll: false },
        include: {
          department:  { select: { name: true } },
          designation: { select: { name: true } },
        },
        orderBy: [{ emp_code: 'asc' }],
      }),
      prisma.attendanceRecord.findMany({
        where: { org_id, date: { gte: fromUtc, lte: toUtc } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          org_id,
          status: 'approved',
          from_date: { lte: toUtc },
          to_date:   { gte: fromUtc },
        },
        include: { leave_type: { select: { code: true, name: true } } },
      }),
      prisma.holiday.findMany({
        where: { org_id, date: { gte: fromUtc, lte: toUtc } },
      }),
    ])

    // ── Lookup maps for O(1) cell resolution ──────────────────────────────
    const recordMap = new Map<string, typeof records[number]>()
    for (const r of records) {
      const key = `${r.employee_id}|${r.date.toISOString().slice(0, 10)}`
      recordMap.set(key, r)
    }

    // Expand each leave into the days it covers. The cell uses the leave
    // type's code (SL, CL, EL, ML, etc.) when available, so HR can read
    // off what kind of leave each day was directly from the grid.
    const leaveByEmpDay = new Map<string, string>()
    for (const lv of leaves) {
      const lvFrom = lv.from_date > fromUtc ? lv.from_date : fromUtc
      const lvTo   = lv.to_date   < toUtc   ? lv.to_date   : toUtc
      const code = (lv.leave_type?.code ?? 'LV').toUpperCase()
      for (let t = lvFrom.getTime(); t <= lvTo.getTime(); t += 86_400_000) {
        leaveByEmpDay.set(`${lv.employee_id}|${new Date(t).toISOString().slice(0, 10)}`, code)
      }
    }

    const holidayByDay = new Map<string, string>()
    for (const h of holidays) {
      holidayByDay.set(h.date.toISOString().slice(0, 10), h.name)
    }

    // ── Build the date list once ──────────────────────────────────────────
    type Day = { iso: string; jsDate: Date; columnLabel: string; isWeekend: boolean }
    const days: Day[] = []
    for (let i = 0; i < dayCount; i++) {
      const t = fromUtc.getTime() + i * 86_400_000
      const d = new Date(t)
      const dow = d.getUTCDay() // 0 = Sun, 6 = Sat
      days.push({
        iso: d.toISOString().slice(0, 10),
        jsDate: d,
        columnLabel: format(d, 'dd-EEE'), // e.g. "07-Mon"
        isWeekend: dow === 0 || dow === 6,
      })
    }

    // ── Header row ─────────────────────────────────────────────────────────
    const fixedLeftHeaders = ['Sl No', 'Emp Code', 'Employee Name', 'Department', 'Designation']
    const summaryHeaders = [
      'Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Holiday',
      'Weekly Off', 'WFH', 'Late Mins', 'OT Hours',
    ]
    const dateHeaders = days.map(d => d.columnLabel)
    const headerRow: (string | number)[] = [
      ...fixedLeftHeaders,
      ...dateHeaders,
      ...summaryHeaders,
    ]

    // ── Build one row per employee ────────────────────────────────────────
    const rows: (string | number)[][] = [headerRow]

    employees.forEach((emp, idx) => {
      let present = 0, absent = 0, late = 0, halfDay = 0
      let leaveCount = 0, holiday = 0, weeklyOff = 0, wfh = 0
      let lateMins = 0, otHours = 0

      const dayCells: string[] = days.map(day => {
        const key = `${emp.id}|${day.iso}`
        const rec = recordMap.get(key)
        const lvCode = leaveByEmpDay.get(key)
        const isHol = holidayByDay.has(day.iso)

        // Resolution: attendance record wins, then leave, then holiday,
        // then weekend, then absent.
        if (rec) {
          let code: string
          switch (rec.status) {
            case 'present':
              if (rec.is_late) { code = 'L'; late++; lateMins += rec.late_by_minutes }
              else             { code = 'P' }
              present++
              break
            case 'late':
              code = 'L'
              late++
              present++
              lateMins += rec.late_by_minutes
              break
            case 'half_day':
              code = 'HD'
              halfDay++
              if (rec.is_late) { lateMins += rec.late_by_minutes }
              break
            case 'wfh':
              code = 'WFH'
              wfh++
              break
            case 'pending_review':
              code = 'PR'
              present++
              break
            case 'leave':
              code = lvCode ?? 'LV'
              leaveCount++
              break
            case 'holiday':
              code = 'H'
              holiday++
              break
            case 'weekly_off':
            case 'weekend':
              code = 'WO'
              weeklyOff++
              break
            default:
              code = 'A'
              absent++
              break
          }
          if (rec.overtime_hours != null) otHours += Number(rec.overtime_hours)
          return code
        }
        if (lvCode) {
          leaveCount++
          return lvCode
        }
        if (isHol) {
          holiday++
          return 'H'
        }
        if (day.isWeekend) {
          weeklyOff++
          return 'WO'
        }
        absent++
        return 'A'
      })

      rows.push([
        idx + 1,
        emp.emp_code,
        `${emp.first_name} ${emp.last_name}`.trim(),
        emp.department?.name ?? '—',
        emp.designation?.name ?? '—',
        ...dayCells,
        present,
        absent,
        late,
        halfDay,
        leaveCount,
        holiday,
        weeklyOff,
        wfh,
        lateMins,
        Number(otHours.toFixed(2)),
      ])
    })

    // ── JSON preview mode ─────────────────────────────────────────────────
    if (fmt === 'json') {
      // Preview returns the structured grid for the client to render
      // verbatim. Date headers + employee rows kept separate so the UI
      // can apply sticky columns on the left fixed headers and a single
      // horizontal scroll across the date strip.
      return NextResponse.json({
        success: true,
        data: {
          fixed_left_headers: fixedLeftHeaders,
          date_headers:       dateHeaders,
          summary_headers:    summaryHeaders,
          rows:               rows.slice(1), // strip header — UI rebuilds from the three header arrays
          employees:          employees.length,
          days:               dayCount,
        },
      })
    }

    // ── Build workbook ────────────────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Column widths — left 5 wide, date columns narrow (just enough for
    // "WFH" or "HD"), summary columns medium.
    ws['!cols'] = [
      { wch: 6 },   // Sl No
      { wch: 13 },  // Emp Code
      { wch: 22 },  // Name
      { wch: 16 },  // Department
      { wch: 16 },  // Designation
      ...days.map(() => ({ wch: 6 })),
      { wch: 9 },   // Present
      { wch: 8 },   // Absent
      { wch: 7 },   // Late
      { wch: 9 },   // Half Day
      { wch: 8 },   // Leave
      { wch: 8 },   // Holiday
      { wch: 10 },  // Weekly Off
      { wch: 7 },   // WFH
      { wch: 10 },  // Late Mins
      { wch: 9 },   // OT Hours
    ]

    // Freeze the left 5 columns + the header row so HR can scroll the
    // date strip horizontally while keeping employee identity visible.
    ws['!freeze'] = { xSplit: 5, ySplit: 1 }
    // xlsx-js doesn't write !freeze into the file directly; the equivalent
    // is the `!ref` + sheet's "frozen pane" view setting via SheetNames
    // worksheet props. For simplicity we omit pane-freezing in the writer
    // — most HRs use the row stripe + column auto-width to find their row.

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Range Attendance')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `attendance_${fromStr}_to_${toStr}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/reports/attendance/range error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate range report' },
      { status: 500 }
    )
  }
}

// Suppress an unused import warning from STATUS_CODE staying for reference
// usage at the top of the file. The Excel/JSON build uses inline switch
// rather than the map (so the order of priority is explicit) but keeping
// STATUS_CODE documents the canonical codes for any future caller.
void STATUS_CODE
