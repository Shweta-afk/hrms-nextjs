import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// XLSX loaded lazily inside handler — keeps cold-start lean
import { format } from 'date-fns'

/**
 * GET /api/reports/attendance/range?from=YYYY-MM-DD&to=YYYY-MM-DD&format=excel|json
 *
 * Range attendance report: one row per (employee × date) across an
 * arbitrary HR-chosen window. Built for the "give me everyone's complete
 * attendance picture between X and Y" workflow — covers timings, half
 * days, lates, weekly offs, holidays AND approved leaves (joined to the
 * leave_requests table so HR sees WHICH leave type was used, not just
 * "on leave").
 *
 * Status priority for each (employee, date) cell:
 *   1. AttendanceRecord present → use its status + timings
 *   2. Approved LeaveRequest covers the date → "On Leave" + leave type
 *   3. Date is a Holiday → "Holiday"
 *   4. Saturday or Sunday → "Weekly Off"
 *   5. Otherwise → "Absent"
 *
 * Excel export uses an aoa-style sheet — same shape as the existing daily
 * report so HR can use the same downstream tooling.
 *
 * Range capped at 92 days. A 50-employee × 92-day report is ~4,600 rows
 * which Excel handles comfortably; anything larger gets noisy and HR
 * usually wants slices anyway.
 */
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

    // Snap to UTC-midnight Date objects so the @db.Date column comparisons
    // are exact — Prisma's Date filtering is brittle when the JS Date has a
    // non-zero time component, and the rest of the codebase consistently
    // uses UTC-midnight as the canonical day boundary.
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

    // Parallel-load every piece of data we need. employees is the spine;
    // the other three feed status resolution per (employee, date).
    const [employees, records, leaves, holidays] = await Promise.all([
      prisma.employee.findMany({
        where: { org_id, status: 'active' },
        include: {
          department:  { select: { name: true } },
          designation: { select: { name: true } },
        },
        orderBy: [{ emp_code: 'asc' }],
      }),
      prisma.attendanceRecord.findMany({
        where: { org_id, date: { gte: fromUtc, lte: toUtc } },
      }),
      // Approved leaves that overlap the requested window. We want any
      // leave whose [from_date, to_date] intersects [fromUtc, toUtc].
      prisma.leaveRequest.findMany({
        where: {
          org_id,
          status: 'approved',
          from_date: { lte: toUtc },
          to_date:   { gte: fromUtc },
        },
        include: { leave_type: { select: { name: true, code: true } } },
      }),
      prisma.holiday.findMany({
        where: { org_id, date: { gte: fromUtc, lte: toUtc } },
      }),
    ])

    // ── Build O(1) lookup maps so the row loop stays linear ────────────────
    // key = `${employee_id}|${ISO date}` — date in YYYY-MM-DD UTC.
    const recordMap = new Map<string, typeof records[number]>()
    for (const r of records) {
      const key = `${r.employee_id}|${r.date.toISOString().slice(0, 10)}`
      recordMap.set(key, r)
    }

    // Leaves are per-employee but cover a date range. We expand each leave
    // into the days it covers (within the requested window) so the row
    // lookup is O(1).
    const leaveByEmpDay = new Map<string, { type_name: string; type_code: string }>()
    for (const lv of leaves) {
      const lvFrom = lv.from_date > fromUtc ? lv.from_date : fromUtc
      const lvTo   = lv.to_date   < toUtc   ? lv.to_date   : toUtc
      for (
        let t = lvFrom.getTime();
        t <= lvTo.getTime();
        t += 86_400_000
      ) {
        const dayIso = new Date(t).toISOString().slice(0, 10)
        leaveByEmpDay.set(`${lv.employee_id}|${dayIso}`, {
          type_name: lv.leave_type?.name ?? 'Leave',
          type_code: lv.leave_type?.code ?? 'LV',
        })
      }
    }

    // Holidays are org-wide for the day.
    const holidayByDay = new Map<string, string>()
    for (const h of holidays) {
      holidayByDay.set(h.date.toISOString().slice(0, 10), h.name)
    }

    // ── Build the date list once ──────────────────────────────────────────
    type Day = { iso: string; jsDate: Date; dayName: string; fmtDate: string; isWeekend: boolean }
    const days: Day[] = []
    for (let i = 0; i < dayCount; i++) {
      const t = fromUtc.getTime() + i * 86_400_000
      const d = new Date(t)
      const dow = d.getUTCDay() // 0 = Sun, 6 = Sat
      days.push({
        iso: d.toISOString().slice(0, 10),
        jsDate: d,
        dayName: format(d, 'EEEE'),
        fmtDate: format(d, 'dd/MM/yyyy'),
        isWeekend: dow === 0 || dow === 6,
      })
    }

    // ── Header row ─────────────────────────────────────────────────────────
    const header = [
      'Sl No', 'Employee Code', 'Employee Name', 'Department', 'Designation',
      'Date', 'Day', 'Status',
      'Time In', 'Time Out', 'Work Hours',
      'Late By (min)', 'Overtime Hours',
      'Leave Type', 'Remarks',
    ]

    const rows: (string | number)[][] = [header]
    let sl = 0

    for (const emp of employees) {
      for (const day of days) {
        sl++
        const key  = `${emp.id}|${day.iso}`
        const rec  = recordMap.get(key)
        const leave = leaveByEmpDay.get(key)
        const holidayName = holidayByDay.get(day.iso)

        // Status resolution. Comments inline because the precedence here
        // shapes every other field — if an employee has BOTH a punch and
        // an approved leave on the same day (rare but legal — e.g. they
        // came in for an hour then left on sick leave), the punch wins.
        let status = 'Absent'
        let timeIn = '—'
        let timeOut = '—'
        let workHours: string | number = '—'
        let lateBy = 0
        let overtime: string | number = '—'
        let leaveTypeLabel = '—'
        let remarks = '—'

        if (rec) {
          // Map internal status → user-facing label, matching the daily report.
          if (rec.status === 'late' || (rec.status === 'present' && rec.is_late)) status = 'Late'
          else if (rec.status === 'present')        status = 'Present'
          else if (rec.status === 'half_day')       status = 'Half Day'
          else if (rec.status === 'wfh')            status = 'WFH'
          else if (rec.status === 'pending_review') status = 'Pending Review'
          else if (rec.status === 'leave')          status = 'On Leave'
          else if (rec.status === 'holiday')        status = 'Holiday'
          else if (rec.status === 'weekly_off' || rec.status === 'weekend') status = 'Weekly Off'
          else                                       status = 'Absent'

          if (rec.first_in)  timeIn  = new Date(rec.first_in).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
          if (rec.last_out)  timeOut = new Date(rec.last_out).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
          if (rec.total_hours != null) workHours = Number(rec.total_hours).toFixed(2)
          lateBy = rec.late_by_minutes
          overtime = rec.overtime_hours != null ? Number(rec.overtime_hours).toFixed(2) : '—'

          if (rec.is_corrected) remarks = 'Corrected'
          else if (rec.source === 'manual')     remarks = 'Manual'
          else if (rec.source === 'csv_import') remarks = 'CSV Import'
          else if (rec.source === 'device')     remarks = 'Device'
          else                                  remarks = 'ESSL'

          // If we ALSO have an approved leave on the same day, surface the
          // leave type so HR can spot the overlap (e.g. "Half Day + SL").
          if (leave) leaveTypeLabel = `${leave.type_code} · ${leave.type_name}`
        } else if (leave) {
          status = 'On Leave'
          leaveTypeLabel = `${leave.type_code} · ${leave.type_name}`
          remarks = 'Approved leave'
        } else if (holidayName) {
          status = 'Holiday'
          remarks = holidayName
        } else if (day.isWeekend) {
          status = 'Weekly Off'
        } else {
          status = 'Absent'
        }

        rows.push([
          sl,
          emp.emp_code,
          `${emp.first_name} ${emp.last_name}`,
          emp.department?.name ?? '—',
          emp.designation?.name ?? '—',
          day.fmtDate,
          day.dayName,
          status,
          timeIn,
          timeOut,
          workHours,
          lateBy,
          overtime,
          leaveTypeLabel,
          remarks,
        ])
      }
    }

    // ── JSON preview mode ─────────────────────────────────────────────────
    if (fmt === 'json') {
      const [headerRow, ...dataRows] = rows
      const jsonRows = dataRows.map((row) => {
        const obj: Record<string, string | number> = {}
        ;(headerRow as string[]).forEach((col, i) => { obj[col] = row[i] })
        return obj
      })
      // Cap preview to first 500 rows — the Excel download has everything,
      // but rendering 5000 rows in the browser preview locks up the tab.
      return NextResponse.json({
        success: true,
        data: {
          rows: jsonRows.slice(0, 500),
          total_rows: jsonRows.length,
          truncated: jsonRows.length > 500,
          employees: employees.length,
          days: dayCount,
        },
      })
    }

    // ── Build workbook ────────────────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet(rows)

    ws['!cols'] = [
      { wch: 6 },   // Sl No
      { wch: 13 },  // Emp Code
      { wch: 22 },  // Name
      { wch: 16 },  // Dept
      { wch: 16 },  // Designation
      { wch: 12 },  // Date
      { wch: 10 },  // Day
      { wch: 14 },  // Status
      { wch: 10 },  // Time In
      { wch: 10 },  // Time Out
      { wch: 12 },  // Work Hours
      { wch: 14 },  // Late By
      { wch: 16 },  // Overtime
      { wch: 22 },  // Leave Type
      { wch: 16 },  // Remarks
    ]

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
