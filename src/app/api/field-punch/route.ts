import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { todayIST, istDateOnly } from '@/lib/ist-date'
import { submitFieldPunch, FieldPunchDebounceError } from '@/lib/field-punch-processor'
import { z } from 'zod'

const SubmitPunchSchema = z.object({
  direction: z.enum(['IN', 'OUT']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).optional(),
  selfie_key: z.string().optional(),
})

// GET /api/field-punch?employee_id=&date= — today's/a day's field punches.
// Employees are always scoped to their own record; admins can query any
// employee in their org. Serves both the portal widget's status check and
// the admin map view's per-day punch points.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const requestedEmployeeId = searchParams.get('employee_id')

    const isEmployee = session.user.role === 'employee'
    if (isEmployee && !session.user.employee_id) {
      return NextResponse.json({ success: false, error: 'No employee record linked' }, { status: 403 })
    }
    const employee_id = isEmployee ? session.user.employee_id! : requestedEmployeeId

    if (!employee_id) {
      return NextResponse.json({ success: false, error: 'employee_id is required' }, { status: 400 })
    }

    const date = dateParam ? istDateOnly(new Date(dateParam)) : todayIST()
    const nextDate = new Date(date.getTime() + 86_400_000)

    const punches = await prisma.fieldPunch.findMany({
      where: {
        org_id: session.user.org_id,
        employee_id,
        punch_time: { gte: date, lt: nextDate },
      },
      include: { geofence: { select: { id: true, name: true, latitude: true, longitude: true } } },
      orderBy: { punch_time: 'asc' },
    })

    return NextResponse.json({ success: true, data: punches })
  } catch (error) {
    console.error('GET /api/field-punch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch field punches' }, { status: 500 })
  }
}

// POST /api/field-punch — GPS punch-in/out for a field agent.
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth()
    if (guard instanceof NextResponse) return guard
    const session = guard

    if (!session.user.employee_id) {
      return NextResponse.json({ success: false, error: 'No employee record linked' }, { status: 403 })
    }

    const employee = await prisma.employee.findFirst({
      where: { id: session.user.employee_id, org_id: session.user.org_id },
      select: { is_field_agent: true },
    })
    if (!employee?.is_field_agent) {
      return NextResponse.json({ success: false, error: 'Not enabled for field attendance' }, { status: 403 })
    }

    const body = await req.json()
    const data = SubmitPunchSchema.parse(body)

    const result = await submitFieldPunch({
      org_id: session.user.org_id,
      employee_id: session.user.employee_id,
      ...data,
    })

    if (result.status === 'rejected') {
      const message =
        result.reject_reason === 'no_geofence_assigned'
          ? 'You have no assigned work sites — contact HR.'
          : `You are ${Math.round(result.distance_m ?? 0)}m outside ${result.geofence?.name ?? 'the assigned site'} (allowed radius ${result.radius_m}m).`
      return NextResponse.json(
        { success: false, error: message, data: result },
        { status: 422 }
      )
    }

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof FieldPunchDebounceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 429 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid request', issues: error.issues }, { status: 400 })
    }
    console.error('POST /api/field-punch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to submit punch' }, { status: 500 })
  }
}
