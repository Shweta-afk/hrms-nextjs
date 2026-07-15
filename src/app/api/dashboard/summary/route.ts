import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { todayIST } from '@/lib/ist-date'

/**
 * GET /api/dashboard/summary
 *
 * Single endpoint that replaces the 4 parallel fetches the HR dashboard's
 * <KpiCards/> was making on mount:
 *   /api/employees?limit=1&payroll_only=true   (just to read .total)
 *   /api/attendance?limit=1                    (just to read .summary.{present,absent})
 *   /api/leave/requests?status=approved&limit=200  (pulled 200 rows to filter client-side!)
 *   /api/recruitment/jobs                       (full list, reduced client-side)
 *
 * Each of those paid: one auth round-trip + one serverless cold start +
 * one DB connection. This collapses them into one invocation with all
 * queries running in parallel against the same connection.
 *
 * Returns the exact shape KpiCards needs — no client-side filtering required.
 */
export async function GET() {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { org_id } = session.user

    const todayUTC = todayIST()

    // Use ONE definition of "active employee" across all three queries below
    // so the percentages line up (otherwise totalEmployees might count people
    // that presentToday excludes, making the attendance rate wrong).
    const ACTIVE_EMPLOYEE = { status: 'active' as const }

    const [
      totalEmployees,
      presentTodayCount,
      onLeaveTodayCount,
      openJobs,
    ] = await Promise.all([
      // Total active employees
      prisma.employee.count({
        where: { org_id, ...ACTIVE_EMPLOYEE },
      }),

      // Present today — includes late, half-day, WFH (all = "showed up")
      prisma.attendanceRecord.count({
        where: {
          org_id,
          date: todayUTC,
          status: { in: ['present', 'late', 'half_day', 'wfh'] },
          employee: ACTIVE_EMPLOYEE,
        },
      }),

      // On leave today — approved leave overlapping today.
      // Uses the new (org_id, status, from_date) index.
      prisma.leaveRequest.count({
        where: {
          org_id,
          status: 'approved',
          from_date: { lte: todayUTC },
          to_date:   { gte: todayUTC },
        },
      }),

      // Open positions — sum openings across open job postings.
      // Fetched as a small slice (id + openings) to keep payload tiny.
      prisma.jobPosting.findMany({
        where: { org_id, status: 'open' },
        select: { openings: true },
      }),
    ])

    const openPositions = openJobs.reduce((sum, j) => sum + (j.openings ?? 0), 0)
    const absentToday = Math.max(0, totalEmployees - presentTodayCount - onLeaveTodayCount)
    const attendanceRate = totalEmployees > 0
      ? Math.round((presentTodayCount / totalEmployees) * 100)
      : 0

    return NextResponse.json({
      success: true,
      data: {
        total_employees: totalEmployees,
        present_today:   presentTodayCount,
        absent_today:    absentToday,
        on_leave_today:  onLeaveTodayCount,
        open_positions:  openPositions,
        attendance_rate: attendanceRate,
      },
    })
  } catch (error) {
    console.error('Dashboard summary error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load dashboard summary' },
      { status: 500 }
    )
  }
}
