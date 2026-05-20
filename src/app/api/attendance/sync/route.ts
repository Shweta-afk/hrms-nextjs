import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPunches, PunchInput } from '@/lib/punch-processor'
import { createHash } from 'crypto'

/**
 * POST /api/attendance/sync
 * Batch attendance sync endpoint for sync agents (desktop / server-side tools).
 *
 * Authentication: Bearer token via Authorization header.
 *   Authorization: Bearer sk_live_<key>
 *
 * Body:
 * {
 *   device_serial: string,           // matches Device.serial_no
 *   punches: Array<{
 *     emp_code:  string,
 *     time:      string,             // ISO 8601
 *     direction: "IN" | "OUT"
 *   }>
 * }
 *
 * Response:
 * { success: true, data: { processed, skipped, errors } }
 */
export async function POST(req: NextRequest) {
  try {
    // ── Auth: extract Bearer key ───────────────────────────────────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!rawKey) {
      return NextResponse.json(
        { success: false, error: 'Missing Authorization header' },
        { status: 401 }
      )
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    const apiKey = await prisma.orgApiKey.findFirst({
      where: { key_hash: keyHash, is_active: true },
    })
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid or revoked API key' },
        { status: 401 }
      )
    }

    // Update last_used asynchronously — don't block the response
    prisma.orgApiKey.update({
      where: { id: apiKey.id },
      data: { last_used: new Date() },
    }).catch(() => {})

    // ── Parse body ─────────────────────────────────────────────────────────
    const body = await req.json()
    const { device_serial, punches } = body as {
      device_serial?: string
      punches?: Array<{ emp_code: string; time: string; direction: string }>
    }

    if (!Array.isArray(punches) || punches.length === 0) {
      return NextResponse.json(
        { success: false, error: 'punches array is required and must be non-empty' },
        { status: 400 }
      )
    }

    // ── Resolve device ─────────────────────────────────────────────────────
    const org_id = apiKey.org_id
    let device_id: string
    let device_name: string

    if (device_serial) {
      const device = await prisma.device.findFirst({
        where: { org_id, serial_no: device_serial },
      })
      if (!device) {
        return NextResponse.json(
          { success: false, error: `No device found with serial: ${device_serial}` },
          { status: 404 }
        )
      }
      device_id   = device.id
      device_name = device.name
    } else {
      // Fall back to the first active device in the org
      const device = await prisma.device.findFirst({
        where: { org_id, is_active: true },
        orderBy: { created_at: 'asc' },
      })
      if (!device) {
        return NextResponse.json(
          { success: false, error: 'No active device found for this org' },
          { status: 404 }
        )
      }
      device_id   = device.id
      device_name = device.name
    }

    // ── Build punch inputs ─────────────────────────────────────────────────
    const inputs: PunchInput[] = []
    const parseErrors: string[] = []

    for (const p of punches) {
      const direction = String(p.direction).toUpperCase()
      if (direction !== 'IN' && direction !== 'OUT') {
        parseErrors.push(`Invalid direction "${p.direction}" for emp_code ${p.emp_code}`)
        continue
      }
      const punch_time = new Date(p.time)
      if (isNaN(punch_time.getTime())) {
        parseErrors.push(`Invalid time "${p.time}" for emp_code ${p.emp_code}`)
        continue
      }
      inputs.push({
        org_id,
        device_id,
        device_name,
        emp_code:   String(p.emp_code),
        punch_time,
        direction:  direction as 'IN' | 'OUT',
        raw_data:   JSON.stringify(p),
      })
    }

    // ── Process ────────────────────────────────────────────────────────────
    const result = await processPunches(inputs)

    return NextResponse.json({
      success: true,
      data: {
        processed: result.processed,
        skipped:   result.skipped + parseErrors.length,
        errors:    [...parseErrors, ...result.errors].slice(0, 20),
      },
    })
  } catch (error) {
    console.error('POST /api/attendance/sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Sync failed' },
      { status: 500 }
    )
  }
}
