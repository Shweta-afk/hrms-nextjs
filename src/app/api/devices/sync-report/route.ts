import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Called by ZK Bridge after each sync to record the result.
 * POST /api/devices/sync-report
 * Body: { serial: string, sent: number, matched: number, skipped: number }
 * No auth required — identified by serial number (same as /iclock/cdata).
 */
export async function POST (req: NextRequest) {
  try {
    const { serial, sent, matched, skipped } = await req.json()
    if (!serial) return NextResponse.json({ error: 'serial required' }, { status: 400 })

    const device = await prisma.device.findFirst({ where: { serial_no: serial } })
    if (!device) return NextResponse.json({ error: 'device not found' }, { status: 404 })

    // Update last_sync on the device
    await prisma.device.update({
      where: { id: device.id },
      data:  { last_sync: new Date() },
    })

    // Append to org settings sync_log (keep last 20 entries)
    const org = await prisma.organisation.findUnique({
      where:  { id: device.org_id },
      select: { settings: true },
    })

    const settings    = (org?.settings ?? {}) as Record<string, unknown>
    const existing    = (settings.sync_log ?? []) as Array<Record<string, unknown>>
    const newEntry    = {
      time:    new Date().toISOString(),
      device:  device.name,
      sent,
      matched,
      skipped,
    }
    const updated     = [newEntry, ...existing].slice(0, 20)

    await prisma.organisation.update({
      where: { id: device.org_id },
      data:  { settings: JSON.parse(JSON.stringify({ ...settings, sync_log: updated })) },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('/api/devices/sync-report error:', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
