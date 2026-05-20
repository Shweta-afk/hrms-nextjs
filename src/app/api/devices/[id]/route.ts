import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// GET /api/devices/[id] — single device with recent punch logs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const device = await prisma.device.findFirst({
      where: { id, org_id: session.user.org_id },
    })

    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    const recentPunches = await prisma.punchLog.findMany({
      where: { device_id: id, org_id: session.user.org_id },
      orderBy: { punch_time: 'desc' },
      take: 50,
    })

    // Today punch count
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const punchesToday = await prisma.punchLog.count({
      where: { device_id: id, org_id: session.user.org_id, punch_time: { gte: today } },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...device,
        push_url: `${APP_URL}/api/attendance/device-push/${device.push_token}`,
        punches_today: punchesToday,
        recent_punches: recentPunches,
      },
    })
  } catch (error) {
    console.error('GET /api/devices/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch device' }, { status: 500 })
  }
}

// PATCH /api/devices/[id] — update device settings
export async function PATCH(
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

    const existing = await prisma.device.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    const { name, ip_address, port, location, is_active, serial_no } = await req.json()

    const updated = await prisma.device.update({
      where: { id },
      data: {
        ...(name !== undefined       && { name }),
        ...(ip_address !== undefined && { ip_address }),
        ...(port !== undefined       && { port: Number(port) }),
        ...(location !== undefined   && { location }),
        ...(is_active !== undefined  && { is_active }),
        ...(serial_no !== undefined  && { serial_no }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/devices/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update device' }, { status: 500 })
  }
}

// DELETE /api/devices/[id] — remove device
export async function DELETE(
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

    const existing = await prisma.device.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    // Remove enrollments and punch logs first (FK constraints)
    await prisma.deviceEnrollment.deleteMany({ where: { device_id: id } })
    await prisma.punchLog.deleteMany({ where: { device_id: id } })
    await prisma.device.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    console.error('DELETE /api/devices/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete device' }, { status: 500 })
  }
}
