import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/devices/[id]/heartbeat
 * Called by the device (or a sync agent) to report it is alive.
 * No session auth — device cannot hold JWT tokens.
 * Identifies the device via push_token in the request body or query param.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Accept push_token from query string or JSON body
    let push_token = new URL(req.url).searchParams.get('token')
    if (!push_token) {
      try {
        const body = await req.json()
        push_token = body?.push_token ?? null
      } catch {
        // Not JSON — that's fine
      }
    }

    const whereClause = push_token
      ? { push_token }
      : { id }

    const device = await prisma.device.findFirst({ where: whereClause })

    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    await prisma.device.update({
      where: { id: device.id },
      data: { last_heartbeat: new Date(), status: 'online' },
    })

    return NextResponse.json({ success: true, data: { status: 'online' } })
  } catch (error) {
    console.error('POST /api/devices/[id]/heartbeat error:', error)
    return NextResponse.json({ success: false, error: 'Heartbeat failed' }, { status: 500 })
  }
}
