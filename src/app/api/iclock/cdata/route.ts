/**
 * Standard ZKTeco / ESSL ADMS push endpoint.
 *
 * ALL ZKTeco and ESSL devices (AIFACE Magnum, ZK400, iClock series…) POST
 * attendance data here automatically once the server address is configured.
 *
 * Device settings on hardware:
 *   Communication → ADMS → Server Address = https://your-domain.vercel.app
 *   (device appends /iclock/cdata automatically — no path needed)
 *
 * Protocol:
 *   GET  /iclock/cdata?SN=DEVICE_SN&options=...  → "OK" heartbeat reply
 *   POST /iclock/cdata?SN=DEVICE_SN&table=ATTLOG → attendance punches
 *
 * Device is identified by its serial number (SN param), which must be saved
 * in HRMS when the device is first registered (auto-saved on first contact).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPunch } from '@/lib/punch-processor'

/** Parse ZKTeco local time string → UTC Date using device timezone. */
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
    const parts = formatter.formatToParts(naiveUtc)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
    const localStr = `${get('year')}-${get('month')}-${get('day')}T${get('hour').padStart(2, '0')}:${get('minute')}:${get('second')}Z`
    const offsetMs = new Date(localStr).getTime() - naiveUtc.getTime()
    return new Date(naiveUtc.getTime() - offsetMs)
  } catch {
    return new Date(normalized)
  }
}

/** Resolve device by serial number. Auto-saves SN on first-seen if device
 *  was registered without it (e.g. user added device manually). */
async function resolveDevice(sn: string) {
  if (!sn) return null

  const device = await prisma.device.findFirst({
    where: { serial_no: sn, is_active: true },
  })

  return device
}

// ── GET — device heartbeat / initial handshake ────────────────────────────────
export async function GET(req: NextRequest) {
  const sn = req.nextUrl.searchParams.get('SN') ?? req.nextUrl.searchParams.get('sn') ?? ''

  try {
    const device = await resolveDevice(sn)

    if (device) {
      await prisma.device.update({
        where: { id: device.id },
        data: { last_heartbeat: new Date(), status: 'online' },
      })
    }
    // Always respond OK — device needs this to confirm server is alive
    // ZKTeco expects: GET_STAMPER: (optional stamp) + newline
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch {
    return new Response('OK', { status: 200 })
  }
}

// ── POST — attendance punch data ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const sn = req.nextUrl.searchParams.get('SN') ?? req.nextUrl.searchParams.get('sn') ?? ''

  try {
    const device = await resolveDevice(sn)

    if (!device) {
      // Unknown device — still return OK so it doesn't retry-storm
      console.warn(`[iclock/cdata] Unknown device SN: ${sn}`)
      return new Response('OK', { status: 200 })
    }

    // Update heartbeat regardless of table type
    await prisma.device.update({
      where: { id: device.id },
      data: { last_heartbeat: new Date(), status: 'online' },
    })

    // Parse body — can be URL-encoded or raw text
    const contentType = req.headers.get('content-type') ?? ''
    let table = req.nextUrl.searchParams.get('table') ?? ''
    let data  = ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text   = await req.text()
      const params = new URLSearchParams(text)
      table = table || params.get('table') || ''
      data  = params.get('data') ?? ''
    } else {
      // Some firmware sends raw text lines: "table=ATTLOG\ndata=..."
      const text = await req.text()
      const lines = text.split(/\r?\n/)
      for (const line of lines) {
        if (line.startsWith('table=')) table = table || line.slice(6).trim()
        if (line.startsWith('data='))  data  = data  || line.slice(5).trim()
      }
      if (!data) data = text // fallback: entire body is data lines
    }

    if (table !== 'ATTLOG' || !data.trim()) {
      return new Response('OK', { status: 200 })
    }

    const punchLines = data.split(/\r?\n/).filter(l => l.trim())
    let processed = 0
    let skipped   = 0

    for (const line of punchLines) {
      const fields = line.split('\t')
      if (fields.length < 3) { skipped++; continue }

      const [empCode, datetimeStr, stateStr] = fields
      const state     = parseInt(stateStr ?? '0', 10)
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
        if (result.skipped) skipped++
        else processed++
      } catch {
        skipped++
      }
    }

    if (processed > 0) {
      await prisma.device.update({
        where: { id: device.id },
        data: { total_punches: { increment: processed } },
      })
    }

    // ZKTeco expects plain "OK" — do NOT return JSON here
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (err) {
    console.error('[iclock/cdata] error:', err)
    return new Response('OK', { status: 200 })
  }
}
