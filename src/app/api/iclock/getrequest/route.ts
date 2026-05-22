/**
 * ZKTeco / ESSL ADMS command polling endpoint.
 *
 * Devices poll GET /iclock/getrequest?SN=... periodically asking if the
 * server has any pending commands (e.g. enroll, delete user, reboot).
 *
 * We return an empty response for now — no commands queued.
 * This keeps the device happy and prevents timeout retries.
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const sn = req.nextUrl.searchParams.get('SN') ?? req.nextUrl.searchParams.get('sn') ?? ''

  try {
    if (sn) {
      const device = await prisma.device.findFirst({
        where: { serial_no: sn, is_active: true },
        select: { id: true },
      })
      if (device) {
        await prisma.device.update({
          where: { id: device.id },
          data: { last_heartbeat: new Date(), status: 'online' },
        })
      }
    }
  } catch { /* non-fatal */ }

  // Empty response = no pending commands
  return new Response('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}
