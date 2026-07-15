import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { todayIST } from '@/lib/ist-date'

/**
 * GET /api/attendance/trend?months=6
 *
 * Returns N months of attendance percentage in a single query.
 * Replaces <AttendanceChart/> firing N parallel /api/attendance?month=X
 * requests on every dashboard load (paying N auth checks + N round-trips).
 *
 * Algorithm:
 *   1) One groupBy on attendance_records over the whole range, bucketed by
 *      month + status. Single index scan on (org_id, status, date).
 *   2) One count() for active payroll-included employees.
 *   3) Compute expected employee-days per month using the org's work_days
 *      setting, then attendance % = present / expected.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { org_id } = session.user

    const { searchParams } = new URL(req.url)
    const months = Math.min(Math.max(parseInt(searchParams.get('months') || '6'), 1), 24)

    const now = new Date()
    const todayUTC = todayIST()

    // Build month windows from oldest → newest.
    const windows = Array.from({ length: months }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1))
      const start = d
      const end   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))   // last day
      return {
        label: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
        month: d.getUTCMonth() + 1,
        year:  d.getUTCFullYear(),
        start,
        end:   end < todayUTC ? end : todayUTC,   // don't count days that haven't happened
      }
    })

    const rangeStart = windows[0].start
    const rangeEnd   = windows[windows.length - 1].end

    // Read org work_days setting once for the expected-days calculation
    const orgRow = await prisma.organisation.findFirst({
      where: { id: org_id },
      select: { settings: true },
    })
    const settings = (orgRow?.settings as Record<string, unknown> | null) ?? {}
    const workDays = (settings.work_days as number[] | undefined) ?? [1, 2, 3, 4, 5, 6]
    const workDaySet = new Set(workDays)

    const totalActive = await prisma.employee.count({
      where: {
        org_id,
        status: { notIn: ['terminated', 'resigned'] },
      },
    })

    // Single grouped query covering the whole range
    const rows = await prisma.attendanceRecord.findMany({
      where: {
        org_id,
        date: { gte: rangeStart, lte: rangeEnd },
        status: { in: ['present', 'late', 'half_day', 'wfh'] },
        employee: { status: 'active' },
      },
      select: { date: true },
    })

    // Bucket rows by (year, month) → present-day count
    const presentByMonth = new Map<string, number>()
    for (const r of rows) {
      const d = r.date
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
      presentByMonth.set(key, (presentByMonth.get(key) ?? 0) + 1)
    }

    const data = windows.map(w => {
      let workingDays = 0
      const cursor = new Date(w.start)
      while (cursor <= w.end) {
        if (workDaySet.has(cursor.getUTCDay())) workingDays++
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
      const expected = totalActive * workingDays
      const present  = presentByMonth.get(`${w.year}-${w.month}`) ?? 0
      const attendance = expected > 0 ? Math.round((present / expected) * 100) : 0
      return { month: w.label, attendance }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Attendance trend error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load attendance trend' },
      { status: 500 }
    )
  }
}
