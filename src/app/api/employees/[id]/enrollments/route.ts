import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/employees/[id]/enrollments
 * Returns all org devices with this employee's enrollment status on each.
 * Admin-only — reveals device topology + employee→device mapping.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const org_id = session.user.org_id

    const employee = await prisma.employee.findFirst({
      where: { id, org_id },
      select: { id: true },
    })
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const [devices, enrollments] = await Promise.all([
      prisma.device.findMany({
        where: { org_id, is_active: true },
        orderBy: { created_at: 'asc' },
        select: { id: true, name: true, location: true, last_heartbeat: true },
      }),
      prisma.deviceEnrollment.findMany({
        where: { org_id, employee_id: id },
      }),
    ])

    const enrollmentMap = new Map(enrollments.map((e) => [e.device_id, e]))

    const data = devices.map((d) => {
      const minutesAgo = d.last_heartbeat
        ? (Date.now() - d.last_heartbeat.getTime()) / 60_000
        : Infinity
      const device_status =
        !d.last_heartbeat ? 'never_connected'
        : minutesAgo <= 2 ? 'online'
        : minutesAgo <= 5 ? 'idle'
        : 'offline'

      const enrollment = enrollmentMap.get(d.id)
      return {
        device_id: d.id,
        device_name: d.name,
        device_location: d.location,
        device_status,
        enrollment: enrollment
          ? {
              status: enrollment.status,
              synced_at: enrollment.synced_at?.toISOString() ?? null,
              enrolled_at: enrollment.enrolled_at?.toISOString() ?? null,
            }
          : null,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('GET /api/employees/[id]/enrollments error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch enrollments' },
      { status: 500 }
    )
  }
}
