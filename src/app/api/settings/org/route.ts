import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const OrgSettingsSchema = z.object({
  industry: z.string().optional(),
  company_size: z.string().optional(),
  headquarters: z.string().optional(),
  payroll_day: z.number().min(1).max(31).optional(),
  pf_applicable: z.boolean().optional(),
  esi_applicable: z.boolean().optional(),
  pt_state: z.string().optional(),
  tds_regime: z.string().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const org = await prisma.organisation.findUnique({ where: { id: session.user.org_id } })
  if (!org) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

  return NextResponse.json({ success: true, data: { settings: org.settings, name: org.name, plan: org.plan } })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'hr_admin') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const updates = OrgSettingsSchema.parse(body)

    const org = await prisma.organisation.findUnique({ where: { id: session.user.org_id } })
    if (!org) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const currentSettings = (org.settings as Record<string, unknown>) ?? {}
    const newSettings = { ...currentSettings, ...updates }

    await prisma.organisation.update({
      where: { id: session.user.org_id },
      data: { settings: newSettings },
    })

    return NextResponse.json({ success: true, data: { settings: newSettings } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 })
  }
}
