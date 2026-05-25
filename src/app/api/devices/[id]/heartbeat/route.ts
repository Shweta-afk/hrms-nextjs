import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/devices/[id]/heartbeat
 * Called by the device (or a sync agent) to report it is alive.
 * No session auth — device cannot hold JWT tokens.
 *
 * The device MUST present its push_token (in `?token=` or `{ push_token }` body) —
 * the URL `id` is guessable / discoverable, so it cannot be trusted on its own.
 * Without a valid push_token the request is rejected (401).
 *
 * The token is also checked against the URL `id` so a leaked token for one device
 * can't be used to spoof heartbeats for a different device.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Accept push_token from query string or JSON body. Required.
    let push_token = new URL(req.url).searchParams.get('token')
    if (!push_token) {
      try {
        const body = await req.json()
        push_token = body?.push_token ?? null
      } catch {
        // Not JSON — that's fine
      }
    }

    if (!push_token) {
      return NextResponse.json(
        { success: false, error: 'Missing push_token' },
        { status: 401 }
      )
    }

    const device = await prisma.device.findUnique({ where: { push_token } })

    // Token must exist AND match the device id in the URL
    if (!device || device.id !== id || !device.is_active) {
      return NextResponse.json(
        { success: false, error: 'Invalid push_token' },
        { status: 401 }
      )
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
