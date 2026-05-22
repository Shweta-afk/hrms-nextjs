import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/** Derive the public base URL from env var, or fall back to the incoming request origin. */
function getAppUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl && !envUrl.includes('localhost')) return envUrl.replace(/\/$/, '')
  // Derive from request host — works on Vercel even without NEXT_PUBLIC_APP_URL set
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

/** Derive online/offline status from last_heartbeat timestamp. */
function computeStatus(lastHeartbeat: Date | null, storedStatus: string): string {
  if (!lastHeartbeat) return 'never_connected'
  const minutesAgo = (Date.now() - lastHeartbeat.getTime()) / 60_000
  if (minutesAgo <= 2) return 'online'
  if (minutesAgo <= 5) return 'idle'
  return 'offline'
}

// GET /api/devices — list all devices for the org
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const devices = await prisma.device.findMany({
      where: { org_id: session.user.org_id },
      orderBy: { created_at: 'asc' },
    })

    // Count today's punches per device
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const todayCounts = await prisma.punchLog.groupBy({
      by: ['device_id'],
      where: {
        org_id: session.user.org_id,
        punch_time: { gte: today },
      },
      _count: { id: true },
    })

    const countMap = Object.fromEntries(todayCounts.map((r) => [r.device_id, r._count.id]))

    const data = devices.map((d) => ({
      ...d,
      status: computeStatus(d.last_heartbeat, d.status),
      push_url: `${getAppUrl(req)}/api/attendance/device-push/${d.push_token}`,
      punches_today: countMap[d.id] ?? 0,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('GET /api/devices error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch devices' }, { status: 500 })
  }
}

// POST /api/devices — add a new device
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { name, model, ip_address, port = 4370, location, timezone } = await req.json()

    if (!name || !ip_address) {
      return NextResponse.json(
        { success: false, error: 'name and ip_address are required' },
        { status: 400 }
      )
    }

    const device = await prisma.device.create({
      data: {
        org_id:     session.user.org_id,
        name,
        model:      model ?? null,
        ip_address,
        port:       Number(port),
        location:   location ?? null,
        timezone:   timezone ?? 'Asia/Kolkata',
        status:     'offline',
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...device,
          push_url: `${getAppUrl(req)}/api/attendance/device-push/${device.push_token}`,
          punches_today: 0,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/devices error:', error)
    return NextResponse.json({ success: false, error: 'Failed to add device' }, { status: 500 })
  }
}
