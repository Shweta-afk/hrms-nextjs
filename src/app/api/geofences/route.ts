import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateGeofenceSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_m: z.number().int().min(10).max(50_000).optional(),
})

// GET /api/geofences — list org's sites with assigned-employee counts
export async function GET() {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const geofences = await prisma.geofence.findMany({
      where: { org_id: session.user.org_id },
      include: { _count: { select: { assignments: true } } },
      orderBy: { created_at: 'desc' },
    })

    const data = geofences.map((g) => ({
      ...g,
      assigned_employee_count: g._count.assignments,
      _count: undefined,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('GET /api/geofences error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch geofences' }, { status: 500 })
  }
}

// POST /api/geofences — create a new site
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json()
    const data = CreateGeofenceSchema.parse(body)

    const geofence = await prisma.geofence.create({
      data: {
        org_id: session.user.org_id,
        name: data.name,
        address: data.address ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        radius_m: data.radius_m ?? 200,
      },
    })

    return NextResponse.json({ success: true, data: geofence }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid request', issues: error.issues }, { status: 400 })
    }
    console.error('POST /api/geofences error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create geofence' }, { status: 500 })
  }
}
