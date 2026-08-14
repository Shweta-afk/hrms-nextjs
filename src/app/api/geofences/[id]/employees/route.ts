import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const AssignSchema = z.object({
  employee_ids: z.array(z.string()).min(1),
})

// GET /api/geofences/[id]/employees — all org employees, flagged with
// whether they're assigned to this site.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { id: geofenceId } = await params
    const org_id = session.user.org_id

    const geofence = await prisma.geofence.findFirst({ where: { id: geofenceId, org_id } })
    if (!geofence) {
      return NextResponse.json({ success: false, error: 'Geofence not found' }, { status: 404 })
    }

    const [employees, assignments] = await Promise.all([
      prisma.employee.findMany({
        where: { org_id, status: 'active', is_field_agent: true },
        select: {
          id: true, emp_code: true, first_name: true, last_name: true,
          department: { select: { name: true } },
        },
        orderBy: { emp_code: 'asc' },
      }),
      prisma.employeeGeofence.findMany({
        where: { org_id, geofence_id: geofenceId },
        select: { employee_id: true },
      }),
    ])

    const assignedIds = new Set(assignments.map((a) => a.employee_id))
    const rows = employees.map((emp) => ({
      employee_id: emp.id,
      emp_code: emp.emp_code,
      name: `${emp.first_name} ${emp.last_name}`,
      department: emp.department?.name ?? null,
      assigned: assignedIds.has(emp.id),
    }))

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('GET /api/geofences/[id]/employees error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch employees' }, { status: 500 })
  }
}

// POST /api/geofences/[id]/employees — assign one or more employees to this site
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { id: geofenceId } = await params
    const org_id = session.user.org_id

    const geofence = await prisma.geofence.findFirst({ where: { id: geofenceId, org_id } })
    if (!geofence) {
      return NextResponse.json({ success: false, error: 'Geofence not found' }, { status: 404 })
    }

    const body = await req.json()
    const { employee_ids } = AssignSchema.parse(body)

    const employees = await prisma.employee.findMany({
      where: { id: { in: employee_ids }, org_id },
      select: { id: true },
    })
    if (employees.length !== employee_ids.length) {
      return NextResponse.json({ success: false, error: 'One or more employees not found' }, { status: 400 })
    }

    await prisma.employeeGeofence.createMany({
      data: employees.map((e) => ({
        org_id,
        employee_id: e.id,
        geofence_id: geofenceId,
        assigned_by: session.user.id,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({ success: true, data: { assigned: employees.length } }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid request', issues: error.issues }, { status: 400 })
    }
    console.error('POST /api/geofences/[id]/employees error:', error)
    return NextResponse.json({ success: false, error: 'Failed to assign employees' }, { status: 500 })
  }
}

// DELETE /api/geofences/[id]/employees?employee_id= — unassign one employee
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard
    const { id: geofenceId } = await params
    const org_id = session.user.org_id

    const employee_id = new URL(req.url).searchParams.get('employee_id')
    if (!employee_id) {
      return NextResponse.json({ success: false, error: 'employee_id is required' }, { status: 400 })
    }

    await prisma.employeeGeofence.deleteMany({
      where: { org_id, geofence_id: geofenceId, employee_id },
    })

    return NextResponse.json({ success: true, data: { unassigned: true } })
  } catch (error) {
    console.error('DELETE /api/geofences/[id]/employees error:', error)
    return NextResponse.json({ success: false, error: 'Failed to unassign employee' }, { status: 500 })
  }
}
