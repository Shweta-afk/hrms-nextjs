import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processPunch } from '@/lib/punch-processor'

/**
 * ZKTeco / ESSL standard ADMS push endpoint.
 * Devices (AiFace Magnum, F18, MB20, uFace series, etc.) push here by default.
 *
 * GET  /iclock/cdata?SN=<serial>          — heartbeat / device check-in
 * POST /iclock/cdata                       — attendance log push (ATTLOG)
 *
 * Device is identified by its serial number (SN param), NOT a token.
 * The SN is matched against Device.serial_no in the database.
 * If no match, a new device record is auto-created for the org (first org fallback).
 */

async function resolveDeviceBySN(sn: string) {
  // Try to find by serial number
  let device = await prisma.device.findFirst({ where: { serial_no: sn } })
  if (device) return device

  // Auto-register: find first org and create/reuse a device entry
  const firstOrg = await prisma.organisation.findFirst({ select: { id: true } })
  if (!firstOrg) return null

  // Check if a device with this SN already exists (race-safe)
  device = await prisma.device.upsert({
    where: { push_token: `sn-${sn}` }, // use sn- prefix as unique placeholder
    update: { serial_no: sn, last_heartbeat: new Date(), status: 'online' },
    create: {
      org_id:     firstOrg.id,
      name:       `ESSL Device (${sn})`,
      ip_address: '0.0.0.0',
      port:       4370,
      serial_no:  sn,
      push_token: `sn-${sn}`,
      location:   'Auto-registered',
      status:     'online',
    },
  })
  return device
}

// GET — device heartbeat / check-in
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sn = searchParams.get('SN') ?? searchParams.get('sn') ?? ''

    if (!sn) return new Response('OK', { status: 200 })

    const device = await resolveDeviceBySN(sn)
    if (device) {
      await prisma.device.update({
        where: { id: device.id },
        data: { last_heartbeat: new Date(), status: 'online' },
      })
    }

    // ZKTeco expects plain text "OK" for heartbeat
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch {
    return new Response('OK', { status: 200 })
  }
}

// POST — attendance data push
export async function POST(req: NextRequest) {
  try {
    const text = await req.text()
    const body = new URLSearchParams(text)

    const sn    = body.get('SN') ?? body.get('sn') ?? ''
    const table = body.get('table') ?? ''
    const data  = body.get('data') ?? ''

    const device = sn ? await resolveDeviceBySN(sn) : null

    if (device) {
      await prisma.device.update({
        where: { id: device.id },
        data: { last_heartbeat: new Date(), status: 'online' },
      })
    }

    // Only process attendance logs
    if (table !== 'ATTLOG' || !data.trim() || !device) {
      return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    const lines = data.split(/\r?\n/).filter(l => l.trim())
    let processed = 0

    for (const line of lines) {
      const fields = line.split('\t')
      if (fields.length < 3) continue

      const [empCode, datetimeStr, stateStr] = fields
      const state = parseInt(stateStr ?? '0', 10)
      const punchTime = new Date(datetimeStr.replace(' ', 'T'))
      if (isNaN(punchTime.getTime())) continue

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
        if (!result.skipped) processed++
      } catch { /* skip bad records */ }
    }

    if (processed > 0) {
      await prisma.device.update({
        where: { id: device.id },
        data: { total_punches: { increment: processed } },
      })
    }

    // ZKTeco standard response — plain text "OK"
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (error) {
    console.error('/iclock/cdata error:', error)
    return new Response('OK', { status: 200 })
  }
}
