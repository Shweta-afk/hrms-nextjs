import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const org_id = session.user.org_id
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    // Build the 6-month date ranges once
    const monthRanges = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(currentYear, currentMonth - (5 - i), 1)
      const monthNum = date.getMonth() + 1
      const yearNum = date.getFullYear()
      return {
        label: date.toLocaleDateString('en-IN', { month: 'short' }),
        from: new Date(Date.UTC(yearNum, monthNum - 1, 1)),
        to: new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59)),
      }
    })

    // ── Fire all independent top-level queries in parallel ──
    const [
      totalEmployees,
      newHiresThisQuarter,
      deptBreakdown,
      leaveTypes,
      candidateCounts,
      lateEmployees,
    ] = await Promise.all([
      prisma.employee.count({ where: { org_id, status: 'active' } }),
      prisma.employee.count({
        where: {
          org_id,
          date_of_joining: {
            gte: new Date(currentYear, Math.floor(currentMonth / 3) * 3, 1),
          },
        },
      }),
      prisma.employee.groupBy({
        by: ['department_id'],
        where: { org_id, status: 'active' },
        _count: { id: true },
      }),
      prisma.leaveType.findMany({
        where: { org_id },
        select: { id: true, code: true },
      }),
      prisma.candidate.groupBy({
        by: ['stage'],
        where: { org_id },
        _count: { id: true },
      }),
      prisma.attendanceRecord.groupBy({
        by: ['employee_id'],
        where: {
          org_id,
          is_late: true,
          date: { gte: new Date(currentYear, currentMonth - 3, 1) },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      }),
    ])

    // ── Department lookup (needs deptBreakdown result first) ──
    const deptIds = deptBreakdown.map(d => d.department_id).filter(Boolean) as string[]
    const departments = await prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    })
    const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]))
    const departmentData = deptBreakdown
      .map(d => ({
        dept: d.department_id ? (deptMap[d.department_id] ?? 'Unknown') : 'Unassigned',
        count: d._count.id,
      }))
      .sort((a, b) => b.count - a.count)

    // ── Attendance trend — all 6 months in parallel (18 queries at once) ──
    const leaveTypeMap = Object.fromEntries(leaveTypes.map(l => [l.id, l.code]))

    const [attendanceTrendRaw, leaveUtilizationRaw] = await Promise.all([
      Promise.all(
        monthRanges.map(({ from, to }) =>
          Promise.all([
            prisma.attendanceRecord.count({ where: { org_id, date: { gte: from, lte: to } } }),
            prisma.attendanceRecord.count({ where: { org_id, date: { gte: from, lte: to }, status: 'present' } }),
            prisma.attendanceRecord.count({ where: { org_id, date: { gte: from, lte: to }, is_late: true } }),
          ])
        )
      ),
      Promise.all(
        monthRanges.map(({ from, to }) =>
          prisma.leaveRequest.groupBy({
            by: ['leave_type_id'],
            where: { org_id, status: 'approved', from_date: { gte: from, lte: to } },
            _sum: { total_days: true },
          })
        )
      ),
    ])

    const attendanceTrend = attendanceTrendRaw.map(([total, present, late], i) => ({
      month: monthRanges[i].label,
      present: total > 0 ? Math.round((present / total) * 100) : 0,
      late: total > 0 ? Math.round((late / total) * 100) : 0,
    }))

    const leaveUtilization = leaveUtilizationRaw.map((leaves, i) => {
      const row: Record<string, any> = { month: monthRanges[i].label }
      leaves.forEach(l => {
        const code = leaveTypeMap[l.leave_type_id] ?? 'Other'
        row[code] = Number(l._sum.total_days ?? 0)
      })
      return row
    })

    // ── Recruitment funnel ──
    const stageMap = Object.fromEntries(candidateCounts.map(c => [c.stage, c._count.id]))
    const funnel = [
      { stage: 'Applications', value: Object.values(stageMap).reduce((a, b) => a + b, 0) },
      { stage: 'Screened', value: (stageMap['screening'] ?? 0) + (stageMap['interview'] ?? 0) + (stageMap['final'] ?? 0) + (stageMap['offer'] ?? 0) },
      { stage: 'Interviewed', value: (stageMap['interview'] ?? 0) + (stageMap['final'] ?? 0) + (stageMap['offer'] ?? 0) },
      { stage: 'Offered', value: stageMap['offer'] ?? 0 },
    ]

    // ── Attrition risk (needs lateEmployees result) ──
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
        headcount: { total: totalEmployees, new_hires_quarter: newHiresThisQuarter },
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
