import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPunch } from '@/lib/punch-processor'

/**
 * ZKTeco PUSH API receiver.
 * No session auth — device sends raw HTTP; identified only by push_token in the URL.
 *
 * GET  — device heartbeat (device polls to verify server is alive)
 * POST — attendance punch data in ZKTeco ATTLOG format:
 *   Content-Type: application/x-www-form-urlencoded
 *   Body: SN=DEV001&table=ATTLOG&Stamp=9999&data=EMP001\t2026-05-16 09:02:15\t0\t1\t0\t0
 *
 * Tab-delimited data fields per record:
 *   [0] emp_code
 *   [1] datetime  (YYYY-MM-DD HH:MM:SS, device local time)
 *   [2] status    (0=check-in, 1=check-out, 4=OT-in, 5=OT-out)
 *   [3] verify    (1=fingerprint, 4=password, 15=face)
 *   [4] work_code
 *   [5] reserved
 *
 * Device expects response: {"ret":1} on success.
 * Respond in <500ms — devices time-out and retry aggressively.
 */

async function resolveDevice(token: string) {
  return prisma.device.findUnique({ where: { push_token: token } })
}

// GET — heartbeat (device checking server is alive)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const device = await resolveDevice(token)
    if (!device) {
      return new Response('NOT FOUND', { status: 404 })
    }

    await prisma.device.update({
      where: { id: device.id },
      data: { last_heartbeat: new Date(), status: 'online' },
    })

    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch {
    return new Response('ERROR', { status: 500 })
  }
}

// POST — punch data push from device
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const device = await resolveDevice(token)

    if (!device || !device.is_active) {
      return NextResponse.json({ ret: -1 }, { status: 404 })
    }

    // Parse URL-encoded body
    const text = await req.text()
    const body = new URLSearchParams(text)

    const table = body.get('table') ?? ''
    const sn    = body.get('SN') ?? body.get('sn') ?? ''
    const data  = body.get('data') ?? ''

    // Update device heartbeat regardless of table type
    await prisma.device.update({
      where: { id: device.id },
      data: { last_heartbeat: new Date(), status: 'online' },
    })

    // Only process ATTLOG table (ignore OPERLOG, OPLOG, etc.)
    if (table !== 'ATTLOG' || !data.trim()) {
      return NextResponse.json({ ret: 1 })
    }

    // Each line in data is one punch record (separated by \r\n or \n)
    const lines = data.split(/\r?\n/).filter((l) => l.trim())

    let processed = 0
    let skipped   = 0

    for (const line of lines) {
      const fields = line.split('\t')
      if (fields.length < 3) { skipped++; continue }

      const [empCode, datetimeStr, stateStr] = fields
      const state = parseInt(stateStr ?? '0', 10)

      // Parse datetime — device sends local time, we treat as-is
      const punchTime = new Date(datetimeStr.replace(' ', 'T'))
      if (isNaN(punchTime.getTime())) { skipped++; continue }

      const direction: 'IN' | 'OUT' = [0, 4].includes(state) ? 'IN' : 'OUT'

      try {
        const result = await processPunch({
          org_id:      device.org_id,
          device_id:   device.id,
          device_name: device.name,
          emp_code:    empCode.trim(),
          punch_time:  punchTime,
          direction,
          raw_data:    `SN=${sn}&${line}`,
        })
        if (result.skipped) skipped++
        else processed++
      } catch {
        skipped++
      }
    }

    // Increment total punch counter
    if (processed > 0) {
      await prisma.device.update({
        where: { id: device.id },
        data: { total_punches: { increment: processed } },
      })
    }

    // ZKTeco devices expect exactly {"ret":1} to confirm receipt
    return NextResponse.json({ ret: 1 })
  } catch (error) {
    console.error('device-push error:', error)
    // Return ret:1 anyway so device doesn't retry storm
    return NextResponse.json({ ret: 1 })
  }
}
