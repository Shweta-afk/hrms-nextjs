import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateGeofenceSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius_m: z.number().int().min(10).max(50_000).optional(),
  is_active: z.boolean().optional(),
})

// GET /api/geofences/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { id } = await params

    const geofence = await prisma.geofence.findFirst({
      where: { id, org_id: session.user.org_id },
      include: { _count: { select: { assignments: true } } },
    })
    if (!geofence) {
      return NextResponse.json({ success: false, error: 'Geofence not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: geofence })
  } catch (error) {
    console.error('GET /api/geofences/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch geofence' }, { status: 500 })
  }
}

// PATCH /api/geofences/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { id } = await params

    const existing = await prisma.geofence.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Geofence not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = UpdateGeofenceSchema.parse(body)

    const updated = await prisma.geofence.update({ where: { id }, data })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid request', issues: error.issues }, { status: 400 })
    }
    console.error('PATCH /api/geofences/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update geofence' }, { status: 500 })
  }
}

// DELETE /api/geofences/[id] — soft delete only. FieldPunch.geofence_id
// references sites for audit history, so a hard delete would either fail
// the FK or blank out past punches' site attribution.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { id } = await params

    const existing = await prisma.geofence.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Geofence not found' }, { status: 404 })
    }

    await prisma.geofence.update({ where: { id }, data: { is_active: false } })

    return NextResponse.json({ success: true, data: { deactivated: true } })
  } catch (error) {
    console.error('DELETE /api/geofences/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to deactivate geofence' }, { status: 500 })
  }
}
