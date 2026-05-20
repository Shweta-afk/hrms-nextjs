import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/attendance/live
 * Today's live attendance summary — designed for 30-second polling.
 *
 * Returns:
 * {
 *   summary: { total_employees, present, absent, late, not_yet_in, currently_inside },
 *   currently_inside: Employee[],   — last punch today is IN
 *   not_yet_arrived: Employee[],    — active employees with no punch today
 *   recent_punches: PunchLog[],     — last 20 punches with employee details
 *   late_today: AttendanceRecord[], — is_late = true for today
 *   devices: Device[]               — with live online/offline status
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const org_id = session.user.org_id

    // Today window in UTC (date-only comparison)
    const now = new Date()
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const todayEnd   = new Date(todayStart.getTime() + 86_400_000)

    // --- Parallel queries ---
    const [
      totalEmployees,
      todayRecords,
      recentPunches,
      devices,
    ] = await Promise.all([
      // Total active headcount
      prisma.employee.count({ where: { org_id, status: 'active' } }),

      // All attendance records for today
      prisma.attendanceRecord.findMany({
        where: { org_id, date: todayStart },
        include: {
          employee: {
            select: {
              id:          true,
              first_name:  true,
              last_name:   true,
              emp_code:    true,
              department:  { select: { name: true } },
              designation: { select: { name: true } },
            },
          },
        },
      }),

      // Last 20 punch logs across all devices, with employee lookup
      prisma.punchLog.findMany({
        where: { org_id, punch_time: { gte: todayStart, lt: todayEnd } },
        orderBy: { punch_time: 'desc' },
        take: 20,
      }),

      // All devices with heartbeat for online/offline status
      prisma.device.findMany({
        where: { org_id },
        orderBy: { created_at: 'asc' },
      }),
    ])

    // --- Currently inside: last punch today was IN ---
    // Group punch logs by emp_code, find last direction per employee today
    const allTodayPunches = await prisma.punchLog.findMany({
      where: { org_id, punch_time: { gte: todayStart, lt: todayEnd }, processed: true },
      orderBy: { punch_time: 'asc' },
    })

    const lastDirectionByEmpCode: Record<string, 'IN' | 'OUT'> = {}
    for (const p of allTodayPunches) {
      lastDirectionByEmpCode[p.emp_code] = p.direction as 'IN' | 'OUT'
    }

    // Map present records
    const presentMap = new Map(todayRecords.map((r) => [r.employee_id, r]))
    const presentIds = new Set(todayRecords.filter((r) => r.status === 'present').map((r) => r.employee_id))

    const presentCount   = todayRecords.filter((r) => r.status === 'present').length
    const lateToday      = todayRecords.filter((r) => r.is_late)
    const absentCount    = totalEmployees - presentCount

    // Who is currently inside (last punch = IN)
    const currentlyInsideRecords = todayRecords.filter((r) => {
      const empCode = r.employee?.emp_code
      return empCode && lastDirectionByEmpCode[empCode] === 'IN'
    })

    const currentlyInsideCount = currentlyInsideRecords.length

    // Not yet arrived: active employees with no attendance record today
    const allActiveEmployees = await prisma.employee.findMany({
      where: { org_id, status: 'active' },
      select: {
        id:          true,
        first_name:  true,
        last_name:   true,
        emp_code:    true,
        department:  { select: { name: true } },
        designation: { select: { name: true } },
      },
    })

    const notYetArrived = allActiveEmployees.filter((e) => !presentIds.has(e.id))

    // Enrich recent punches with employee name
    const empCodeToName: Record<string, string> = {}
    for (const e of allActiveEmployees) {
      empCodeToName[e.emp_code] = `${e.first_name} ${e.last_name}`
    }

    const enrichedPunches = recentPunches.map((p) => ({
      ...p,
      employee_name: empCodeToName[p.emp_code] ?? p.emp_code,
    }))

    // Device status (recompute from heartbeat)
    const enrichedDevices = devices.map((d) => {
      const minutesAgo = d.last_heartbeat
        ? (Date.now() - d.last_heartbeat.getTime()) / 60_000
        : Infinity
      const status =
        !d.last_heartbeat ? 'never_connected'
        : minutesAgo <= 2 ? 'online'
        : minutesAgo <= 5 ? 'idle'
        : 'offline'

      // Today's punches for this device
      const punchesToday = allTodayPunches.filter((p) => p.device_id === d.id).length

      return { ...d, status, punches_today: punchesToday }
    })

    return NextResponse.json({
      success: true,
      data: {
        as_of: now.toISOString(),
        summary: {
          total_employees:  totalEmployees,
          present:          presentCount,
          absent:           absentCount,
          late:             lateToday.length,
          not_yet_in:       notYetArrived.length,
          currently_inside: currentlyInsideCount,
        },
        currently_inside: currentlyInsideRecords.map((r) => ({
          employee_id:  r.employee_id,
          employee:     r.employee,
          first_in:     r.first_in,
          device_name:  r.device_name,
        })),
        not_yet_arrived: notYetArrived,
        recent_punches:  enrichedPunches,
        late_today:      lateToday,
        devices:         enrichedDevices,
      },
    })
  } catch (error) {
    console.error('GET /api/attendance/live error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch live data' }, { status: 500 })
  }
}
