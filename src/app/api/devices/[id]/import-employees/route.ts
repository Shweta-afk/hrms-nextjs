import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { connectToDevice, getDeviceUsers, disconnect } from '@/lib/zkdevice'

/**
 * GET /api/devices/[id]/import-employees
 * Returns all users from the physical device, each tagged with whether
 * they already exist in the HRMS (matched by essl_device_id or emp_code).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { id: deviceId } = await params
    const org_id = session.user.org_id

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, name: true, ip_address: true, port: true, org_id: true },
    })
    if (!device || device.org_id !== org_id) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    // Connect and read users from the physical device
    const zkDevice = await connectToDevice(device.ip_address, device.port)
    const zkUsers = await getDeviceUsers(zkDevice)
    await disconnect(zkDevice)

    // Check which device userIds already exist in HRMS
    const existingEmployees = await prisma.employee.findMany({
      where: {
        org_id,
        OR: [
          { essl_device_id: { in: zkUsers.map((u) => u.userId) } },
          { emp_code:       { in: zkUsers.map((u) => u.userId) } },
        ],
      },
      select: { id: true, emp_code: true, essl_device_id: true, first_name: true, last_name: true },
    })

    const matchedIds = new Set([
      ...existingEmployees.map((e) => e.essl_device_id).filter(Boolean),
      ...existingEmployees.map((e) => e.emp_code),
    ])

    const users = zkUsers.map((u) => ({
      uid:        u.uid,
      userId:     u.userId,
      name:       u.name,
      role:       u.role,
      exists_in_hrms: matchedIds.has(u.userId),
    }))

    return NextResponse.json({ success: true, data: { device_name: device.name, users } })
  } catch (error) {
    console.error('GET /api/devices/[id]/import-employees error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

/**
 * POST /api/devices/[id]/import-employees
 * Body: { employees: [{ userId, name, emp_code?, department_id? }] }
 * Creates HRMS employees from the device user list.
 * Skips any userId that already exists (essl_device_id or emp_code match).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { id: deviceId } = await params
    const org_id = session.user.org_id

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, org_id: true },
    })
    if (!device || device.org_id !== org_id) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    const body = await req.json()
    const employees: {
      userId: string
      name: string
      emp_code: string
      department_id?: string | null
      designation_id?: string | null
      date_of_joining?: string
    }[] = body.employees ?? []

    if (!employees.length) {
      return NextResponse.json({ success: false, error: 'No employees provided' }, { status: 400 })
    }

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const emp of employees) {
      try {
        // Skip if already in HRMS
        const exists = await prisma.employee.findFirst({
          where: {
            org_id,
            OR: [{ essl_device_id: emp.userId }, { emp_code: emp.emp_code }],
          },
        })
        if (exists) { skipped++; continue }

        // Parse name: "First Last" → split on first space
        const nameParts = emp.name.trim().split(/\s+/)
        const first_name = nameParts[0] ?? emp.name
        const last_name  = nameParts.slice(1).join(' ') || '.'

        await prisma.employee.create({
          data: {
            org_id,
            emp_code:       emp.emp_code,
            essl_device_id: emp.userId,
            first_name,
            last_name,
            email:           `${emp.emp_code.toLowerCase()}@company.com`,  // placeholder
            employment_type: 'full_time',
            status:          'active',
            date_of_joining: emp.date_of_joining
              ? new Date(emp.date_of_joining)
              : new Date(),
            department_id:   emp.department_id  ?? null,
            designation_id:  emp.designation_id ?? null,
          },
        })
        created++
      } catch (err) {
        errors.push(`${emp.emp_code}: ${String(err)}`)
        skipped++
      }
    }

    return NextResponse.json({ success: true, data: { created, skipped, errors } })
  } catch (error) {
    console.error('POST /api/devices/[id]/import-employees error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
