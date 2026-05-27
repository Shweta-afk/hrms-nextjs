import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPunch } from '@/lib/punch-processor'

/**
 * ZKTeco / ESSL / AiFace ADMS attendance push endpoint.
 *
 * Devices POST to: /iclock/cdata?SN=SERIAL&table=ATTLOG&Stamp=...
 * Body (application/x-www-form-urlencoded): data=EMP\tDATETIME\tSTATUS\tVERIFY\r\n...
 *
 * IMPORTANT: SN and table come from QUERY PARAMS, not the body.
 * Device is identified by serial_no — set it in Settings → Biometric Devices.
 */

/** Convert device local time string → UTC Date using device's configured timezone */
function parseDeviceTime(datetimeStr: string, timezone: string): Date {
  const normalized = datetimeStr.trim().replace(' ', 'T')
  try {
    const naiveUtc = new Date(normalized + 'Z')
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
    const parts   = formatter.formatToParts(naiveUtc)
    const get     = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
    const localStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour').padStart(2,'0')}:${get('minute')}:${get('second')}Z`
    const offsetMs = new Date(localStr).getTime() - naiveUtc.getTime()
    return new Date(naiveUtc.getTime() - offsetMs)
  } catch {
    return new Date(normalized)
  }
}

// GET — heartbeat (device checks server is alive)
export async function GET(req: NextRequest) {
  const sn = req.nextUrl.searchParams.get('SN') ?? req.nextUrl.searchParams.get('sn') ?? ''
  if (sn) {
    const device = await prisma.device.findFirst({ where: { serial_no: sn } }).catch(() => null)
    if (device) {
      prisma.device.update({
        where: { id: device.id },
        data:  { last_heartbeat: new Date(), status: 'online' },
      }).catch(() => {})
    }
  }
  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

// POST — attendance data push from device
export async function POST(req: NextRequest) {
  try {
    // SN and table are QUERY PARAMS — not in the body
    const sn    = req.nextUrl.searchParams.get('SN') ?? req.nextUrl.searchParams.get('sn') ?? ''
    const table = req.nextUrl.searchParams.get('table') ?? ''

    // Parse body for the actual punch data
    const text = await req.text().catch(() => '')
    const body = new URLSearchParams(text)
    const data = body.get('data') ?? ''

    if (!sn) return new Response('OK: 0', { status: 200, headers: { 'Content-Type': 'text/plain' } })

    // Look up device by serial number
    const device = await prisma.device.findFirst({ where: { serial_no: sn } }).catch(() => null)

    // Update heartbeat regardless
    if (device) {
      prisma.device.update({
        where: { id: device.id },
        data:  { last_heartbeat: new Date(), status: 'online' },
      }).catch(() => {})
    } else {
      // Serial not registered — log and acknowledge so device doesn't retry-storm
      console.warn(`[iclock/cdata] Unregistered device SN: ${sn} — add serial in Settings → Biometric Devices`)
      return new Response('OK: 0', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    // Only process ATTLOG; ignore OPERLOG, photos, etc.
    if (table !== 'ATTLOG' || !data.trim()) {
      return new Response('OK: 0', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    const lines = data.split(/\r?\n/).filter(l => l.trim())
    let processed = 0
    let skipped   = 0

    for (const line of lines) {
      const fields = line.split('\t')
      if (fields.length < 2) { skipped++; continue }

      const [empCode, datetimeStr, stateStr] = fields
      const state     = parseInt(stateStr ?? '0', 10)
      // Use device timezone for correct IST → UTC conversion
      const punchTime = parseDeviceTime(datetimeStr, device.timezone ?? 'Asia/Kolkata')
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
        result.skipped ? skipped++ : processed++
      } catch {
        skipped++
      }
    }

    if (processed > 0) {
      prisma.device.update({
        where: { id: device.id },
        data:  { total_punches: { increment: processed } },
      }).catch(() => {})
    }

    return new Response(`OK: ${processed}`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err) {
    console.error('/iclock/cdata error:', err)
    // Always return OK — device must not get stuck in retry loop
    return new Response('OK: 0', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
}
