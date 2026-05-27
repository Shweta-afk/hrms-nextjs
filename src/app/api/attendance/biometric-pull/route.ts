import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processPunches, PunchInput } from '@/lib/punch-processor'

interface DeviceLog {
  UserId: string
  LogDate: string
  SerialNumber: string
  DeviceSName: string
}

/**
 * POST /api/attendance/biometric-pull
 * Pulls swipe logs from a third-party biometric API and converts them
 * into attendance records using the existing punch-processor pipeline.
 *
 * Body:
 * {
 *   from_date: "YYYY-MM-DD",
 *   to_date:   "YYYY-MM-DD",
 *   // Optional — overrides org settings for one-off pulls
 *   api_url?:      string,
 *   api_key?:      string,
 *   account_name?: string,
 * }
 *
 * The biometric API must return an array of:
 * { UserId, LogDate (ISO timestamp), SerialNumber, DeviceSName }
 *
 * Direction logic: for each employee-day, sort punches by time:
 *   - First punch  → IN
 *   - Last punch   → OUT  (if > 1 punch)
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const session = guard

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const { from_date, to_date } = body as { from_date?: string; to_date?: string }

  if (!from_date || !to_date) {
    return NextResponse.json(
      { success: false, error: 'from_date and to_date are required' },
      { status: 400 }
    )
  }

  // Load biometric config from org settings (with optional body overrides)
  const org = await prisma.organisation.findUnique({
    where: { id: session.user.org_id },
    select: { settings: true },
  })
  const orgSettings   = (org?.settings ?? {}) as Record<string, unknown>
  const biometricConf = (orgSettings.biometric ?? {}) as Record<string, unknown>

  const apiUrl      = String(body.api_url      ?? biometricConf.api_url      ?? '')
  const apiKey      = String(body.api_key      ?? biometricConf.api_key      ?? '')
  const accountName = String(body.account_name ?? biometricConf.account_name ?? '')

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { success: false, error: 'Biometric API URL and key are not configured. Save them in Settings first.' },
      { status: 400 }
    )
  }

  // Build the third-party API request URL
  let fetchUrl: string
  try {
    const url = new URL(apiUrl)
    url.searchParams.set('APIKey',   apiKey)
    url.searchParams.set('FromDate', from_date)
    url.searchParams.set('ToDate',   to_date)
    if (accountName) url.searchParams.set('AccountName', accountName)
    fetchUrl = url.toString()
  } catch {
    return NextResponse.json(
      { success: false, error: `Invalid API URL: ${apiUrl}` },
      { status: 400 }
    )
  }

  // ── Fetch from biometric API ──────────────────────────────────────────────
  let logs: DeviceLog[] = []
  try {
    const res = await fetch(fetchUrl, {
      signal:  AbortSignal.timeout(30_000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json(
        { success: false, error: `Biometric API returned HTTP ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }
    const raw = await res.json()
    // Support various response shapes
    if (Array.isArray(raw))               logs = raw
    else if (Array.isArray(raw?.data))    logs = raw.data
    else if (Array.isArray(raw?.Data))    logs = raw.Data
    else if (Array.isArray(raw?.logs))    logs = raw.logs
    else if (Array.isArray(raw?.Logs))    logs = raw.Logs
    else                                  logs = []
  } catch (err) {
    const msg = String(err)
    const friendly = msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
      ? 'Cannot reach biometric API — check if it is accessible from the internet.'
      : `Fetch error: ${msg}`
    return NextResponse.json({ success: false, error: friendly }, { status: 502 })
  }

  if (logs.length === 0) {
    return NextResponse.json({
      success: true,
      data: { fetched: 0, processed: 0, skipped: 0, unmatched: [], errors: [] },
    })
  }

  // ── Resolve / create a virtual "Biometric API Pull" device ───────────────
  let bioDevice = await prisma.device.findFirst({
    where: { org_id: session.user.org_id, serial_no: 'BIOMETRIC-API-PULL' },
  })
  if (!bioDevice) {
    let ipAddress = '0.0.0.0'
    try { ipAddress = new URL(apiUrl).hostname } catch {}
    bioDevice = await prisma.device.create({
      data: {
        org_id:    session.user.org_id,
        name:      'Biometric API Pull',
        ip_address: ipAddress,
        serial_no: 'BIOMETRIC-API-PULL',
        location:  'Remote API',
        is_active: true,
      },
    })
  }

  // ── Group punches: UserId + date → [logs], then assign IN / OUT ──────────
  const grouped = new Map<string, DeviceLog[]>()
  for (const log of logs) {
    if (!log.UserId || !log.LogDate) continue
    const date = log.LogDate.substring(0, 10) // "YYYY-MM-DD"
    const key  = `${log.UserId}__${date}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(log)
  }

  const inputs: PunchInput[] = []
  for (const [, dayLogs] of grouped) {
    const sorted = [...dayLogs].sort(
      (a, b) => new Date(a.LogDate).getTime() - new Date(b.LogDate).getTime()
    )
    const empCode    = sorted[0].UserId.trim()
    const deviceName = sorted[0].DeviceSName ?? 'Biometric'

    // First punch = IN
    inputs.push({
      org_id:      session.user.org_id,
      device_id:   bioDevice.id,
      device_name: deviceName,
      emp_code:    empCode,
      punch_time:  new Date(sorted[0].LogDate),
      direction:   'IN',
      raw_data:    JSON.stringify(sorted[0]),
    })

    // Last punch = OUT (only if there's more than one punch in the day)
    if (sorted.length > 1) {
      const last = sorted[sorted.length - 1]
      inputs.push({
        org_id:      session.user.org_id,
        device_id:   bioDevice.id,
        device_name: last.DeviceSName ?? deviceName,
        emp_code:    empCode,
        punch_time:  new Date(last.LogDate),
        direction:   'OUT',
        raw_data:    JSON.stringify(last),
      })
    }
  }

  // ── Process through the existing punch pipeline ───────────────────────────
  const result = await processPunches(inputs)

  // Extract unmatched employee codes from errors
  const unmatched = [
    ...new Set(
      result.errors
        .filter(e => e.startsWith('Unknown emp_code:'))
        .map(e => e.replace('Unknown emp_code: ', '').trim())
    ),
  ]

  // Update device last_sync
  prisma.device.update({
    where: { id: bioDevice.id },
    data:  { last_sync: new Date() },
  }).catch(() => {})

  return NextResponse.json({
    success: true,
    data: {
      fetched:   logs.length,
      processed: result.processed,
      skipped:   result.skipped,
      unmatched,
      errors: result.errors
        .filter(e => !e.startsWith('Unknown emp_code:'))
        .slice(0, 20),
    },
  })
}
