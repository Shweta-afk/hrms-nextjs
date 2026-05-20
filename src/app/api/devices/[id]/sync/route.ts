import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { connectToDevice, getAttendanceLogs, getDeviceInfo, disconnect } from '@/lib/zkdevice'
import { processPunches } from '@/lib/punch-processor'

// POST /api/devices/[id]/sync — pull attendance logs from device via ZKTeco SDK
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const device = await prisma.device.findFirst({
      where: { id, org_id: session.user.org_id, is_active: true },
    })

    if (!device) {
      return NextResponse.json({ success: false, error: 'Device not found' }, { status: 404 })
    }

    // Mark device as syncing
    await prisma.device.update({
      where: { id },
      data: { status: 'syncing' },
    })

    let zkDevice
    try {
      zkDevice = await connectToDevice(device.ip_address, device.port)

      // Fetch device serial if not set yet
      if (!device.serial_no) {
        try {
          const info = await getDeviceInfo(zkDevice)
          await prisma.device.update({
            where: { id },
            data: { serial_no: info.serialNumber },
          })
        } catch {
          // Non-fatal — serial_no stays null
        }
      }

      // Pull logs since last sync (or all if first sync)
      const logs = await getAttendanceLogs(zkDevice, device.last_sync ?? undefined)

      // Convert ZKTeco state to direction
      const punches = logs.map((log) => ({
        org_id:      session.user.org_id,
        device_id:   id,
        device_name: device.name,
        emp_code:    log.id,
        punch_time:  log.timestamp,
        // state 0/4=IN, 1/5=OUT
        direction:   ([0, 4].includes(log.state) ? 'IN' : 'OUT') as 'IN' | 'OUT',
        raw_data:    JSON.stringify(log),
      }))

      const result = await processPunches(punches)

      // Update device sync metadata
      await prisma.device.update({
        where: { id },
        data: {
          last_sync:    new Date(),
          last_heartbeat: new Date(),
          status:       'online',
          total_punches: { increment: result.processed },
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          processed:   result.processed,
          skipped:     result.skipped,
          errors:      result.errors.slice(0, 20),
          total_pulled: logs.length,
        },
      })
    } catch (syncErr) {
      // Device unreachable — mark offline
      await prisma.device.update({
        where: { id },
        data: { status: 'offline' },
      })
      const msg = syncErr instanceof Error ? syncErr.message : 'Unknown error'
      return NextResponse.json(
        { success: false, error: `Sync failed: ${msg}` },
        { status: 502 }
      )
    } finally {
      if (zkDevice) {
        await disconnect(zkDevice).catch(() => {})
      }
    }
  } catch (error) {
    console.error('POST /api/devices/[id]/sync error:', error)
    return NextResponse.json({ success: false, error: 'Sync request failed' }, { status: 500 })
  }
}
