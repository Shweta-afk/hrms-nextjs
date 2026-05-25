import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import {
  getDaysInMonth, isWeekend, eachDayOfInterval,
  startOfMonth, endOfMonth, parseISO, format,
} from 'date-fns'

/**
 * GET /api/reports/attendance/monthly?month=5&year=2026&format=excel
 *
 * Generates the monthly attendance summary report matching Smart Office output.
 * Columns: Sl No, Emp Code, Name, Dept, Working Days, Present, Absent, Late Days,
 *          Total Late Min, Half Days, OT Hours, Leave (by type code), LOP Days,
 *          Net Pay Days, Attendance %
 */
export async function GET(req: NextRequest) {
  try {
    // Org-wide monthly attendance report — admin-only.
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')
    const fmt = searchParams.get('format') ?? 'excel'

    if (!monthParam || !yearParam) {
      return NextResponse.json(
        { success: false, error: 'month and year query parameters are required' },
        { status: 400 }
      )
    }

    const month = parseInt(monthParam, 10)  // 1-12
    const year  = parseInt(yearParam,  10)

    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
      return NextResponse.json({ success: false, error: 'Invalid month or year' }, { status: 400 })
    }

    const org_id = session.user.org_id

    // UTC-safe month boundaries
    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    const monthEnd   = new Date(Date.UTC(year, month, 1)) // exclusive

    // ── Parallel data fetch ─────────────────────────────────────────────────
    const [employees, records, leaveRequests, holidays, leaveTypes] = await Promise.all([
      prisma.employee.findMany({
        where: { org_id, status: 'active' },
        include: {
          department: { select: { name: true } },
          designation: { select: { name: true } },
        },
        orderBy: [{ emp_code: 'asc' }],
      }),

      prisma.attendanceRecord.findMany({
        where: {
          org_id,
          date: { gte: monthStart, lt: monthEnd },
        },
      }),

      prisma.leaveRequest.findMany({
        where: {
          org_id,
          status: 'approved',
          from_date: { lt: monthEnd },
          to_date:   { gte: monthStart },
        },
        include: { leave_type: { select: { code: true, name: true, is_paid: true } } },
      }),

      prisma.holiday.findMany({
        where: {
          org_id,
          date: { gte: monthStart, lt: monthEnd },
        },
        select: { date: true },
      }),

      prisma.leaveType.findMany({
        where: { org_id },
        select: { code: true, name: true, is_paid: true },
        orderBy: { code: 'asc' },
      }),
    ])

    // ── Working days in month ────────────────────────────────────────────────
    const holidayDates = new Set(
      holidays.map((h) => format(h.date, 'yyyy-MM-dd'))
    )
    const allDays = eachDayOfInterval({
      start: startOfMonth(new Date(year, month - 1)),
      end:   endOfMonth(new Date(year, month - 1)),
    })
    const workingDaysInMonth = allDays.filter(
      (d) => !isWeekend(d) && !holidayDates.has(format(d, 'yyyy-MM-dd'))
    ).length

    // ── Index records by employee_id ─────────────────────────────────────────
    const recordsByEmployee = new Map<string, typeof records>()
    for (const rec of records) {
      const list = recordsByEmployee.get(rec.employee_id) ?? []
      list.push(rec)
      recordsByEmployee.set(rec.employee_id, list)
    }

    // ── Index leave by employee_id ───────────────────────────────────────────
    const leaveByEmployee = new Map<string, typeof leaveRequests>()
    for (const lr of leaveRequests) {
      const list = leaveByEmployee.get(lr.employee_id) ?? []
      list.push(lr)
      leaveByEmployee.set(lr.employee_id, list)
    }

    // ── Build per-employee leave day counts by leave type code ───────────────
    function countLeaveDaysInMonth(
      leaveList: typeof leaveRequests,
      typeCode: string
    ): number {
      return leaveList
        .filter((lr) => lr.leave_type.code === typeCode)
        .reduce((sum, lr) => {
          // Clamp leave period to the report month
          const start = lr.from_date > monthStart ? lr.from_date : monthStart
          const end   = lr.to_date < monthEnd    ? lr.to_date   : new Date(monthEnd.getTime() - 86_400_000)
          const days  = eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length
          return sum + days
        }, 0)
    }

    // ── Header row ───────────────────────────────────────────────────────────
    const leaveTypeCols = leaveTypes.map((lt) => `Leave (${lt.code})`)
    const header = [
      'Sl No', 'Employee Code', 'Employee Name', 'Department',
      'Total Working Days', 'Present Days', 'Absent Days', 'Late Days',
      'Total Late Minutes', 'Half Days', 'Overtime Hours',
      ...leaveTypeCols,
      'LOP Days', 'Net Pay Days', 'Attendance %',
    ]

    const rows: (string | number)[][] = [header]

    // ── One row per employee ─────────────────────────────────────────────────
    employees.forEach((emp, idx) => {
      const empRecords = recordsByEmployee.get(emp.id) ?? []
      const empLeaves  = leaveByEmployee.get(emp.id)  ?? []

      const presentDays = empRecords.filter((r) => r.status === 'present').length
      const halfDays    = empRecords.filter((r) => r.status === 'half_day').length
      const lateDays    = empRecords.filter((r) => r.is_late).length
      const totalLateMins = empRecords.reduce((s, r) => s + r.late_by_minutes, 0)
      const overtimeHrs   = empRecords.reduce((s, r) => s + Number(r.overtime_hours ?? 0), 0)

      // Leave days by type
      const leaveCounts = leaveTypes.map((lt) => countLeaveDaysInMonth(empLeaves, lt.code))
      const totalLeaveDays = leaveCounts.reduce((s, c) => s + c, 0)

      // Paid-leave day count for LOP calc (only unpaid leaves count toward LOP)
      const paidLeaveDays = leaveTypes.reduce((s, lt, i) => {
        return lt.is_paid ? s + leaveCounts[i] : s
      }, 0)

      const absentDays = Math.max(0, workingDaysInMonth - presentDays - halfDays - totalLeaveDays)
      const lopDays    = Math.max(0, absentDays)
      const netPayDays = Math.max(0, workingDaysInMonth - lopDays + paidLeaveDays)
      const attendancePct =
        workingDaysInMonth > 0
          ? ((presentDays + halfDays * 0.5) / workingDaysInMonth * 100).toFixed(1)
          : '0.0'

      rows.push([
        idx + 1,
        emp.emp_code,
        `${emp.first_name} ${emp.last_name}`,
        emp.department?.name ?? '—',
        workingDaysInMonth,
        presentDays,
        absentDays,
        lateDays,
        totalLateMins,
        halfDays,
        Number(overtimeHrs.toFixed(2)),
        ...leaveCounts,
        lopDays,
        netPayDays,
        attendancePct,
      ])
    })

    // ── JSON preview mode ────────────────────────────────────────────────────
    if (fmt === 'json') {
      const [headerRow, ...dataRows] = rows
      const jsonRows = dataRows.map((row) => {
        const obj: Record<string, string | number> = {}
        ;(headerRow as string[]).forEach((col, i) => { obj[col] = row[i] })
        return obj
      })
      return NextResponse.json({ success: true, data: jsonRows })
    }

    // ── Build workbook ───────────────────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet(rows)

    const fixedCols = [6, 13, 22, 16, 16, 11, 11, 10, 17, 10, 16]
    const leaveCols = leaveTypes.map(() => ({ wch: 14 }))
    const trailCols = [{ wch: 10 }, { wch: 12 }, { wch: 13 }]
    ws['!cols'] = [...fixedCols.map((w) => ({ wch: w })), ...leaveCols, ...trailCols]

    const monthLabel = format(new Date(year, month - 1), 'MMMM_yyyy')
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Summary')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `attendance_monthly_${monthLabel}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/reports/attendance/monthly error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate monthly report' },
      { status: 500 }
    )
  }
}
