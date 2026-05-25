import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Org-wide analytics — admin-only.
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const org_id = session.user.org_id
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    // ── Headcount ──
    const totalEmployees = await prisma.employee.count({
      where: { org_id, status: 'active' },
    })

    const newHiresThisQuarter = await prisma.employee.count({
      where: {
        org_id,
        date_of_joining: {
          gte: new Date(currentYear, Math.floor(currentMonth / 3) * 3, 1),
        },
      },
    })

    // ── Department breakdown ──
    const deptBreakdown = await prisma.employee.groupBy({
      by: ['department_id'],
      where: { org_id, status: 'active' },
      _count: { id: true },
    })

    const deptIds = deptBreakdown.map(d => d.department_id).filter(Boolean) as string[]
    const departments = await prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    })

    const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]))
    const departmentData = deptBreakdown.map(d => ({
      dept: d.department_id ? (deptMap[d.department_id] ?? 'Unknown') : 'Unassigned',
      count: d._count.id,
    })).sort((a, b) => b.count - a.count)

    // ── Attendance trend (last 6 months) ──
    const attendanceTrend = []
    for (let i = 5; i >= 0; i--) {
      const month = new Date(currentYear, currentMonth - i, 1)
      const monthNum = month.getMonth() + 1
      const yearNum = month.getFullYear()

      const fromDate = new Date(Date.UTC(yearNum, monthNum - 1, 1))
      const toDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59))

      const [total, present, late] = await Promise.all([
        prisma.attendanceRecord.count({
          where: { org_id, date: { gte: fromDate, lte: toDate } },
        }),
        prisma.attendanceRecord.count({
          where: { org_id, date: { gte: fromDate, lte: toDate }, status: 'present' },
        }),
        prisma.attendanceRecord.count({
          where: { org_id, date: { gte: fromDate, lte: toDate }, is_late: true },
        }),
      ])

      attendanceTrend.push({
        month: month.toLocaleDateString('en-IN', { month: 'short' }),
        present: total > 0 ? Math.round((present / total) * 100) : 0,
        late: total > 0 ? Math.round((late / total) * 100) : 0,
      })
    }

    // ── Leave utilization (last 6 months) ──
    const leaveUtilization = []
    const leaveTypes = await prisma.leaveType.findMany({
      where: { org_id },
      select: { id: true, code: true },
    })
    const leaveTypeMap = Object.fromEntries(leaveTypes.map(l => [l.id, l.code]))

    for (let i = 5; i >= 0; i--) {
      const month = new Date(currentYear, currentMonth - i, 1)
      const monthNum = month.getMonth() + 1
      const yearNum = month.getFullYear()

      const fromDate = new Date(Date.UTC(yearNum, monthNum - 1, 1))
      const toDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59))

      const leaves = await prisma.leaveRequest.groupBy({
        by: ['leave_type_id'],
        where: {
          org_id,
          status: 'approved',
          from_date: { gte: fromDate, lte: toDate },
        },
        _sum: { total_days: true },
      })

      const row: Record<string, any> = {
        month: month.toLocaleDateString('en-IN', { month: 'short' }),
      }
      leaves.forEach(l => {
        const code = leaveTypeMap[l.leave_type_id] ?? 'Other'
        row[code] = Number(l._sum.total_days ?? 0)
      })
      leaveUtilization.push(row)
    }

    // ── Recruitment funnel ──
    const candidateCounts = await prisma.candidate.groupBy({
      by: ['stage'],
      where: { org_id },
      _count: { id: true },
    })

    const stageMap = Object.fromEntries(candidateCounts.map(c => [c.stage, c._count.id]))
    const funnel = [
      { stage: 'Applications', value: Object.values(stageMap).reduce((a, b) => a + b, 0) },
      { stage: 'Screened', value: (stageMap['screening'] ?? 0) + (stageMap['interview'] ?? 0) + (stageMap['final'] ?? 0) + (stageMap['offer'] ?? 0) },
      { stage: 'Interviewed', value: (stageMap['interview'] ?? 0) + (stageMap['final'] ?? 0) + (stageMap['offer'] ?? 0) },
      { stage: 'Offered', value: stageMap['offer'] ?? 0 },
    ]

    // ── Attrition risk (employees with high late arrivals) ──
    const lateEmployees = await prisma.attendanceRecord.groupBy({
      by: ['employee_id'],
      where: {
        org_id,
        is_late: true,
        date: { gte: new Date(currentYear, currentMonth - 3, 1) },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    })

    const riskEmployeeIds = lateEmployees.map(e => e.employee_id)
    const riskEmployees = await prisma.employee.findMany({
      where: { id: { in: riskEmployeeIds }, org_id, status: 'active' },
      select: {
        id: true,
        emp_code: true,
        first_name: true,
        last_name: true,
        department: { select: { name: true } },
      },
    })

    const riskMap = Object.fromEntries(riskEmployees.map(e => [e.id, e]))
    const attritionRisk = lateEmployees.map(e => ({
      id: riskMap[e.employee_id]?.emp_code ?? e.employee_id.slice(0, 6),
      name: riskMap[e.employee_id]
        ? `${riskMap[e.employee_id].first_name} ${riskMap[e.employee_id].last_name}`
        : 'Unknown',
      dept: riskMap[e.employee_id]?.department?.name ?? '—',
      score: Math.min(95, 50 + e._count.id * 5),
      factors: ['Frequent late arrivals'],
    }))

    return NextResponse.json({
      success: true,
      data: {
        headcount: {
          total: totalEmployees,
          new_hires_quarter: newHiresThisQuarter,
        },
        departmentData,
        attendanceTrend,
        leaveUtilization,
        funnel,
        attritionRisk,
      },
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 })
  }
}