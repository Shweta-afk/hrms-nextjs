import { NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { safeDecrypt } from '@/lib/encryption'

/**
 * GET /api/portal/summary
 *
 * Single endpoint that replaces the 8 parallel fetches the employee portal
 * was making on mount. All queries run in one serverless function invocation
 * (one auth check, one cold start, one DB connection).
 *
 * Returns: leave balances, recent attendance, notifications, latest payslip,
 *          reimbursements, HR requests, upcoming holidays, employee profile.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.employee_id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { org_id, employee_id, id: user_id } = session.user
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    // ── Fire all independent queries in parallel ──────────────────────────────
    const [
      leaveTypes,
      takenLeaves,
      attendanceRecords,
      notifications,
      unreadCount,
      payslips,
      reimbursements,
      requests,
      holidays,
      employee,
      birthdayEmployees,
    ] = await Promise.all([
      // Leave balance parts (need both to compute balance)
      prisma.leaveType.findMany({ where: { org_id } }),
      prisma.leaveRequest.groupBy({
        by: ['leave_type_id'],
        where: {
          org_id,
          employee_id,
          status: 'approved',
          from_date: {
            gte: new Date(`${currentYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`),
          },
        },
        _sum: { total_days: true },
      }),

      // Recent attendance (last 7 days)
      prisma.attendanceRecord.findMany({
        where: {
          org_id,
          employee_id,
          date: {
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          },
        },
        orderBy: { date: 'desc' },
        take: 7,
      }),

      // Notifications (list)
      prisma.notification.findMany({
        where: { org_id, user_id },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),

      // Notifications (unread count)
      prisma.notification.count({
        where: { org_id, user_id, is_read: false },
      }),

      // Latest payslip only
      prisma.payslip.findFirst({
        where: {
          org_id,
          employee_id,
          is_published: true,
          hr_approved_at: { not: null },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        select: {
          id: true, month: true, year: true, net_salary: true,
          gross_salary: true, total_deductions: true,
        },
      }),

      // Reimbursements
      prisma.reimbursement.findMany({
        where: { org_id, employee_id },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),

      // HR requests
      prisma.hRRequest.findMany({
        where: { org_id, employee_id },
        orderBy: { created_at: 'desc' },
        take: 20,
        select: { id: true, type: true, subject: true, status: true, reply: true, created_at: true },
      }),

      // Upcoming holidays (next 3)
      prisma.holiday.findMany({
        where: { org_id, date: { gte: now } },
        orderBy: { date: 'asc' },
        take: 3,
      }),

      // Employee profile — only the fields the portal actually uses.
      // personal_info is included so the home screen knows whether to show
      // the "tell us your birthday" nudge; we don't surface the full JSON
      // to the client, just a derived flag below.
      prisma.employee.findFirst({
        where: { id: employee_id, org_id },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone: true,
          bank_details: true,
          statutory_info: true,
          personal_info: true,
        },
      }),

      // Active employees with personal_info, used downstream to compute
      // the upcoming-birthdays list. We pull the whole list here (rather
      // than a second API round-trip from the client) so the portal stays
      // a single network call.
      prisma.employee.findMany({
        where: { org_id, status: 'active' },
        select: {
          id:            true,
          emp_code:      true,
          first_name:    true,
          last_name:     true,
          personal_info: true,
          department:    { select: { name: true } },
        },
      }),
    ])

    // ── Compute leave balances ────────────────────────────────────────────────
    const takenMap = Object.fromEntries(
      takenLeaves.map(t => [t.leave_type_id, Number(t._sum.total_days ?? 0)])
    )
    const leaveBalances = leaveTypes.map(lt => ({
      id: lt.id,
      code: lt.code,
      name: lt.name,
      is_paid: lt.is_paid,
      total: Number(lt.days_per_year),
      taken: takenMap[lt.id] ?? 0,
      available: Number(lt.days_per_year) - (takenMap[lt.id] ?? 0),
    }))

    // ── Decrypt sensitive fields ──────────────────────────────────────────────
    // Derive a single boolean for the birthday-nudge banner so the client
    // doesn't have to parse the personal_info JSON. The banner disappears
    // automatically once dob_missing is false.
    const personalInfo = (employee?.personal_info ?? {}) as Record<string, unknown>
    const dobMissing = !personalInfo.date_of_birth ||
                       typeof personalInfo.date_of_birth !== 'string' ||
                       personalInfo.date_of_birth.trim() === ''

    const employeeData = employee
      ? {
          ...employee,
          bank_details: safeDecrypt(employee.bank_details),
          statutory_info: safeDecrypt(employee.statutory_info),
          // Strip personal_info from the response — the rest of the portal
          // doesn't use it and we already have what we need (dob_missing).
          // Avoids accidentally surfacing fields like blood_group to a future
          // component that shouldn't display them.
          personal_info: undefined,
          dob_missing: dobMissing,
        }
      : null

    // Compute upcoming birthdays in-process — same util the HR dashboard
    // endpoint uses, so both surfaces show the same list. Excludes the
    // viewing employee themselves.
    const { computeUpcomingBirthdays } = await import('@/lib/birthdays')
    const upcomingBirthdays = computeUpcomingBirthdays(birthdayEmployees, {
      windowDays:        14,
      excludeEmployeeId: employee_id,
    })

    return NextResponse.json({
      success: true,
      data: {
        leaveBalances: leaveBalances.filter(l => l.is_paid && l.total > 0),
        attendance: attendanceRecords,
        notifications: { list: notifications, unread_count: unreadCount },
        payslip: payslips,
        reimbursements,
        requests,
        holidays,
        employee: employeeData,
        upcoming_birthdays: upcomingBirthdays,
      },
    })
  } catch (error) {
    console.error('Portal summary error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load portal data' }, { status: 500 })
  }
}
