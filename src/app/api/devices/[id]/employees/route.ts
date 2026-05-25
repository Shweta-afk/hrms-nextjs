import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { connectToDevice, getDeviceUsers, disconnect } from '@/lib/zkdevice'

/**
 * GET /api/devices/[id]/employees
 *
 * Returns all employees enrolled (or pending) for this device in HRMS,
 * cross-referenced with users actually registered on the physical device.
 * Each record includes `on_device: boolean`.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const { id: deviceId } = await params
    const org_id = session.user.org_id

    // Verify device belongs to this org
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, name: true, ip_address: true, port: true, org_id: true, is_active: true },
    })

    if (!device || device.org_id !== org_id) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    // Fetch all enrollments for this device with employee info
    const enrollments = await prisma.deviceEnrollment.findMany({
      where: { device_id: deviceId, org_id },
      include: {
        employee: {
          select: {
            id: true,
            emp_code: true,
            first_name: true,
            last_name: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
      },
      orderBy: { employee: { emp_code: 'asc' } },
    })

    // Also fetch all active employees in the org for completeness
    const allEmployees = await prisma.employee.findMany({
      where: { org_id, status: 'active' },
      select: {
        id: true,
        emp_code: true,
        first_name: true,
        last_name: true,
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
      orderBy: { emp_code: 'asc' },
    })

    // Try to connect to the device and get physical user list
    let deviceUserIds = new Set<string>()
    let deviceConnected = false
    try {
      const zkDevice = await connectToDevice(device.ip_address, device.port)
      const zkUsers = await getDeviceUsers(zkDevice)
      deviceUserIds = new Set(zkUsers.map((u) => u.userId))
      deviceConnected = true
      await disconnect(zkDevice)
    } catch {
      // Device unreachable — we still return HRMS data, on_device will be null
    }

    // Index enrollments by employee_id
    const enrollmentMap = new Map(enrollments.map((e) => [e.employee_id, e]))

    const rows = allEmployees.map((emp) => {
      const enrollment = enrollmentMap.get(emp.id) ?? null
      return {
        employee_id:  emp.id,
        emp_code:     emp.emp_code,
        name:         `${emp.first_name} ${emp.last_name}`,
        department:   emp.department?.name ?? null,
        designation:  emp.designation?.name ?? null,
        hrms_status:  enrollment?.status ?? 'not_enrolled',
        synced_at:    enrollment?.synced_at ?? null,
        enrolled_at:  enrollment?.enrolled_at ?? null,
        on_device:    deviceConnected ? deviceUserIds.has(emp.emp_code) : null,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        device_id:        device.id,
        device_name:      device.name,
        device_connected: deviceConnected,
        employees:        rows,
      },
    })
  } catch (error) {
    console.error('GET /api/devices/[id]/employees error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch device employees' },
      { status: 500 }
    )
  }
}
