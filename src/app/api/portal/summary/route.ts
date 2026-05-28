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

      // Employee profile — only the fields the portal actually uses
      prisma.employee.findFirst({
        where: { id: employee_id, org_id },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          phone: true,
          bank_details: true,
          statutory_info: true,
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
    const employeeData = employee
      ? {
          ...employee,
          bank_details: safeDecrypt(employee.bank_details),
          statutory_info: safeDecrypt(employee.statutory_info),
        }
      : null

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
      },
    })
  } catch (error) {
    console.error('Portal summary error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load portal data' }, { status: 500 })
  }
}
