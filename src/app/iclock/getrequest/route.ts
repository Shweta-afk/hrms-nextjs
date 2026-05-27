import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * ZKTeco ADMS heartbeat / command-poll endpoint.
 *
 * AiFace Magnum, ESSL, ZKTeco devices call this URL when they boot
 * and periodically to check if the server is alive.
 *
 * GET /iclock/getrequest?SN=DEVICE_SERIAL&options=all&...
 *
 * Device is identified by SN (serial number) — no token needed.
 * Server responds with options so the device knows it's connected.
 */
export async function GET(req: NextRequest) {
  const sn = req.nextUrl.searchParams.get('SN') ?? req.nextUrl.searchParams.get('sn') ?? ''

  if (sn) {
    try {
      const device = await prisma.device.findFirst({
        where: { serial_no: sn },
      })
      if (device) {
        await prisma.device.update({
          where: { id: device.id },
          data: { last_heartbeat: new Date(), status: 'online' },
        })
      }
    } catch { /* non-blocking */ }
  }

  // Respond with ADMS options — device needs this to confirm server connection
  const options = [
    `GET OPTION FROM: ${sn}`,
    'ATTLOGStamp=0',
    'OPERLOGStamp=0',
    'ATTPHOTOStamp=0',
    'ErrorDelay=30',
    'Delay=10',
    'TransTimes=00:00;23:59',
    'TransInterval=1',
    'TransFlag=TransData AttLog',
    'Realtime=1',
    'Encrypt=None',
  ].join('\r\n')

  return new Response(options, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

// Some firmware versions POST to getrequest — handle both
export async function POST(req: NextRequest) {
  return GET(req)
}
