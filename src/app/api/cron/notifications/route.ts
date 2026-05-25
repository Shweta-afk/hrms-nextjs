import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyHRAdmins, notifyEmployeeManager, wasRecentlyNotified } from '@/lib/notifications'

const OFFLINE_ALERT_MINS   = parseInt(process.env.OFFLINE_ALERT_MINUTES ?? '5')
const DEVICE_FULL_THRESHOLD = 90_000   // punches — typical ZKTeco capacity ~100K

/**
 * GET /api/cron/notifications
 * Runs every 15 minutes (Vercel cron). Checks:
 *  1. Devices offline for > OFFLINE_ALERT_MINUTES → notify HR admins
 *  2. Employees not yet arrived by 10:30 AM → notify their manager
 *  3. Device punch storage >90% full → notify HR admins
 *
 * Protected by CRON_SECRET environment variable.
 */
export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  // CRON_SECRET is REQUIRED. If it's not set, fail closed — otherwise the
  // endpoint would be publicly callable (DoS + notification spam vector).
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/notifications] CRON_SECRET env var is not set — refusing to run')
    return NextResponse.json(
      { success: false, error: 'Server misconfiguration' },
      { status: 500 }
    )
  }
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now      = new Date()
  const utcHour  = now.getUTCHours()
  const utcMin   = now.getUTCMinutes()
  // IST is UTC+5:30 → 10:30 AM IST = 05:00 UTC
  const isPast1030IST = utcHour > 5 || (utcHour === 5 && utcMin >= 0)

  let offlineAlerts  = 0
  let absentAlerts   = 0
  let storageAlerts  = 0

  try {
    // Fetch all active orgs with their devices in one pass
    const orgs = await prisma.organisation.findMany({
      where: { is_active: true },
      select: {
        id: true,
        settings: true,
        devices: {
          where: { is_active: true },
          select: {
            id: true, name: true, last_heartbeat: true, total_punches: true,
          },
        },
      },
    })

    for (const org of orgs) {
      const orgSettings  = (org.settings ?? {}) as Record<string, unknown>
      const notifPrefs   = (orgSettings.notifications ?? {}) as Record<string, unknown>

      // ── 1. Device offline check ──────────────────────────────────────────
      for (const device of org.devices) {
        if (!device.last_heartbeat) continue   // never connected — skip

        const minutesOffline = (now.getTime() - device.last_heartbeat.getTime()) / 60_000
        if (minutesOffline < OFFLINE_ALERT_MINS) continue

        // Dedup: only one alert per device per hour
        const alreadyAlerted = await wasRecentlyNotified(
          org.id, 'device_offline', device.name, 60
        )
        if (alreadyAlerted) continue

        await notifyHRAdmins(
          org.id,
          '⚠ Device Offline',
          `${device.name} has not sent a heartbeat for ${Math.floor(minutesOffline)} minutes. Check the device connection.`,
          'device_offline',
          '/settings'
        )
        offlineAlerts++
      }

      // ── 2. Device storage nearly full ────────────────────────────────────
      for (const device of org.devices) {
        if (device.total_punches < DEVICE_FULL_THRESHOLD) continue

        const alreadyAlerted = await wasRecentlyNotified(
          org.id, 'device_storage_full', device.name, 24 * 60  // once per day
        )
        if (alreadyAlerted) continue

        await notifyHRAdmins(
          org.id,
          '⚠ Device Storage Nearly Full',
          `${device.name} has recorded ${device.total_punches.toLocaleString()} punches. Clear old logs to prevent data loss.`,
          'device_storage_full',
          '/settings'
        )
        storageAlerts++
      }

      // ── 3. Not yet arrived check (only after 10:30 AM IST) ──────────────
      if (!isPast1030IST) continue
      if (notifPrefs.absent_check === false) continue

      const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

      // Find active employees in this org who have no attendance record today
      const [allEmployees, todayRecords] = await Promise.all([
        prisma.employee.findMany({
          where: { org_id: org.id, status: 'active' },
          select: { id: true, first_name: true, last_name: true, emp_code: true },
        }),
        prisma.attendanceRecord.findMany({
          where: { org_id: org.id, date: todayStart },
          select: { employee_id: true },
        }),
      ])

      const presentIds = new Set(todayRecords.map((r) => r.employee_id))
      const notArrived = allEmployees.filter((e) => !presentIds.has(e.id))

      for (const emp of notArrived) {
        // Dedup: one absent notification per employee per day
        const alreadySent = await wasRecentlyNotified(
          org.id, 'not_arrived', emp.emp_code, 24 * 60
        )
        if (alreadySent) continue

        await notifyEmployeeManager(
          org.id,
          emp.id,
          'Employee Not Yet Arrived',
          `${emp.first_name} ${emp.last_name} (${emp.emp_code}) has not punched in today.`,
          'not_arrived',
          '/attendance/live'
        )
        absentAlerts++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        checked_at:     now.toISOString(),
        offline_alerts: offlineAlerts,
        absent_alerts:  absentAlerts,
        storage_alerts: storageAlerts,
      },
    })
  } catch (error) {
    console.error('GET /api/cron/notifications error:', error)
    return NextResponse.json({ success: false, error: 'Cron job failed' }, { status: 500 })
  }
}
