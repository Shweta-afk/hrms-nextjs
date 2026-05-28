import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * One-time migration: map Smart Office device IDs to HRMS employees.
 * GET /api/admin/map-device-ids  (must be logged in as admin)
 */

const MAPPING = [
  { emp_code: '777',   device_id: '777' },
  { emp_code: 'A0008', device_id: '25'  },
  { emp_code: 'A0021', device_id: '8'   },
  { emp_code: 'A0037', device_id: '3'   },
  { emp_code: 'A0046', device_id: '20'  },
  { emp_code: 'A0063', device_id: '16'  },
  { emp_code: 'A0071', device_id: '2'   },
  { emp_code: 'A0099', device_id: '52'  },
  { emp_code: 'A0116', device_id: '68'  },
  { emp_code: 'A0130', device_id: '82'  },
  { emp_code: 'A0138', device_id: '87'  },
  { emp_code: 'A0143', device_id: '94'  },
  { emp_code: 'A0161', device_id: '111' },
  { emp_code: 'A0170', device_id: '118' },
  { emp_code: 'A0173', device_id: '121' },
  { emp_code: 'A0175', device_id: '123' },
  { emp_code: 'A0176', device_id: '124' },
  { emp_code: 'A0177', device_id: '125' },
  { emp_code: 'A0180', device_id: '126' },
  { emp_code: 'A0181', device_id: '127' },
  { emp_code: 'A0182', device_id: '128' },
  { emp_code: 'A0183', device_id: '129' },
  { emp_code: 'A0184', device_id: '130' },
  { emp_code: 'A0185', device_id: '131' },
  { emp_code: 'A0189', device_id: '133' },
]

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const org_id = guard.user.org_id
  const results: { emp_code: string; device_id: string; status: string }[] = []

  for (const { emp_code, device_id } of MAPPING) {
    try {
      const updated = await prisma.employee.updateMany({
        where: { org_id, emp_code },
        data:  { essl_device_id: device_id },
      })
      results.push({
        emp_code,
        device_id,
        status: updated.count > 0 ? '✓ updated' : '✗ not found in HRMS',
      })
    } catch (err) {
      results.push({ emp_code, device_id, status: `error: ${String(err)}` })
    }
  }

  const updated = results.filter(r => r.status.startsWith('✓')).length
  const missing = results.filter(r => r.status.startsWith('✗')).length

  return NextResponse.json({
    message: `Done — ${updated} updated, ${missing} not found`,
    results,
  })
}
