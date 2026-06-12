/**
 * POST /api/dev/simulate-punch  (DEVELOPMENT ONLY)
 * Creates a fake punch as if a ZKTeco device sent it.
 * Only available when NODE_ENV !== 'production'.
 *
 * Body: {
 *   org_id?:      string  — defaults to first org in DB
 *   emp_code:     string  — employee code, e.g. "EMP0001"
 *   direction:    "IN" | "OUT"
 *   device_name?: string  — e.g. "Simulator"
 *   punch_time?:  string  — ISO datetime, defaults to now
 * }
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPunch } from '@/lib/punch-processor'

export async function POST(req: NextRequest) {
  // Gate on an EXPLICIT opt-in env var, not NODE_ENV. Vercel/Netlify preview
  // deployments don't have NODE_ENV='production', so the old check leaked
  // this endpoint to every preview URL. Now it's off unless ALLOW_DEV_ENDPOINTS=1.
  // Double-gated: ALLOW_DEV_ENDPOINTS must be explicitly set AND the runtime
  // must not be production. Either guard alone can be bypassed by misconfiguration;
  // together they require two independent mistakes.
  if (
    process.env.ALLOW_DEV_ENDPOINTS !== '1' ||
    process.env.NODE_ENV === 'production'
  ) {
    return NextResponse.json(
      { success: false, error: 'Not available' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { emp_code, direction = 'IN', device_name = 'Simulator', punch_time } = body
    let { org_id } = body

    if (!emp_code) {
      return NextResponse.json({ success: false, error: 'emp_code is required' }, { status: 400 })
    }

    if (!['IN', 'OUT'].includes(direction)) {
      return NextResponse.json(
        { success: false, error: 'direction must be IN or OUT' },
        { status: 400 }
      )
    }

    // Default to first active org if not provided
    if (!org_id) {
      const firstOrg = await prisma.organisation.findFirst({ select: { id: true } })
      if (!firstOrg) {
        return NextResponse.json({ success: false, error: 'No organisations found' }, { status: 404 })
      }
      org_id = firstOrg.id
    }

    // Find or create a simulator device for this org
    let device = await prisma.device.findFirst({
      where: { org_id, name: 'Simulator' },
    })

    if (!device) {
      device = await prisma.device.create({
        data: {
          org_id,
          name:       'Simulator',
          ip_address: '127.0.0.1',
          port:       4370,
          location:   'Development',
          status:     'online',
        },
      })
    }

    const punchAt = punch_time ? new Date(punch_time) : new Date()

    const result = await processPunch({
      org_id,
      device_id:   device.id,
      device_name: device_name,
      emp_code,
      punch_time:  punchAt,
      direction:   direction as 'IN' | 'OUT',
      raw_data:    'simulated',
    })

    // Update device heartbeat
    await prisma.device.update({
      where: { id: device.id },
      data: { last_heartbeat: new Date(), status: 'online', total_punches: { increment: 1 } },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        emp_code,
        direction,
        punch_time: punchAt.toISOString(),
        device_id:  device.id,
      },
    })
  } catch (error) {
    console.error('simulate-punch error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
