import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { connectToDevice, pushEmployee, disconnect } from '@/lib/zkdevice'

/**
 * POST /api/devices/[id]/enroll
 * Push an employee record to the device so they can enroll their biometric.
 * Body: { employee_id: string }
 *
 * This only registers the employee's name+code on the device.
 * The employee must then physically walk to the device and scan their biometric.
 * Biometric data never leaves the device.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { employee_id } = await req.json()
    if (!employee_id) {
      return NextResponse.json({ success: false, error: 'employee_id is required' }, { status: 400 })
    }

    const [device, employee] = await Promise.all([
      prisma.device.findFirst({ where: { id, org_id: session.user.org_id, is_active: true } }),
      prisma.employee.findFirst({
        where: { id: employee_id, org_id: session.user.org_id },
        select: { id: true, emp_code: true, first_name: true, last_name: true },
      }),
    ])

    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }
    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    // Upsert enrollment record as pending
    await prisma.deviceEnrollment.upsert({
      where: { device_id_employee_id: { device_id: id, employee_id } },
      update: { status: 'pending', synced_at: null, enrolled_at: null },
      create: { org_id: session.user.org_id, device_id: id, employee_id, status: 'pending' },
    })

    let zkDevice
    try {
      zkDevice = await connectToDevice(device.ip_address, device.port)
      await pushEmployee(zkDevice, employee)

      // Mark as synced (biometric enrollment itself happens at the physical device)
      await prisma.deviceEnrollment.update({
        where: { device_id_employee_id: { device_id: id, employee_id } },
        data: { status: 'pending', synced_at: new Date() },
      })

      return NextResponse.json({
        success: true,
        data: {
          message: `${employee.first_name} ${employee.last_name} has been pushed to ${device.name}. Ask the employee to walk to the device and scan their biometric to complete enrollment.`,
          status: 'pending',
        },
      })
    } catch (err) {
      await prisma.deviceEnrollment.update({
        where: { device_id_employee_id: { device_id: id, employee_id } },
        data: { status: 'failed' },
      })
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json(
        { success: false, error: `Could not reach device: ${msg}` },
        { status: 502 }
      )
    } finally {
      if (zkDevice) await disconnect(zkDevice).catch(() => {})
    }
  } catch (error) {
    console.error('POST /api/devices/[id]/enroll error:', error)
    return NextResponse.json({ success: false, error: 'Enrollment failed' }, { status: 500 })
  }
}
