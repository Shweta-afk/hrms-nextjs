import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/org/settings
 * Returns the organisation's settings JSON.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const org = await prisma.organisation.findUnique({
      where: { id: session.user.org_id },
      select: { settings: true, name: true },
    })
    if (!org) return NextResponse.json({ success: false, error: 'Org not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: org.settings ?? {} })
  } catch (err) {
    console.error('GET /api/org/settings error:', err)
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 })
  }
}

/**
 * PATCH /api/org/settings
 * Deep-merges the provided keys into the settings JSON.
 * Only HR admins can call this.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()

    const org = await prisma.organisation.findUnique({
      where: { id: session.user.org_id },
      select: { settings: true },
    })

    const existing = (org?.settings ?? {}) as Record<string, unknown>
    const updated  = { ...existing, ...body }

    await prisma.organisation.update({
      where: { id: session.user.org_id },
      data: { settings: updated },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('PATCH /api/org/settings error:', err)
    return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 })
  }
}
