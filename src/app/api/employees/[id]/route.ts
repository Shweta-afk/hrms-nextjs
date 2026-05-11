import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
const UpdateEmployeeSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  department_id: z.string().optional(),
  designation_id: z.string().optional(),
  manager_id: z.string().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  status: z.enum(['active', 'on_notice', 'terminated']).optional(),
  personal_info: z.record(z.string(), z.string()).optional(),
  contact_info: z.record(z.string(), z.string()).optional(),
  essl_device_id: z.string().optional(),
  salary_structure_id: z.string().optional(),
  ctc_annual: z.number().optional(),
})

// GET — single employee
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employee = await prisma.employee.findFirst({
      where: { id: id, org_id: session.user.org_id },
      include: {
        department: true,
        designation: true,
        manager: {
          select: { id: true, first_name: true, last_name: true },
        },
        leave_requests: {
          orderBy: { created_at: 'desc' },
          take: 5,
        },
        attendance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: employee })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch employee' }, { status: 500 })
  }
}

// PATCH — update employee
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = UpdateEmployeeSchema.parse(body)

    const employee = await prisma.employee.updateMany({
      where: { id: id, org_id: session.user.org_id },
      data,
    })

    if (employee.count === 0) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const updated = await prisma.employee.findFirst({
      where: { id: id },
      include: { department: true, designation: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update employee' }, { status: 500 })
  }
}

// DELETE — soft delete (deactivate)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.employee.updateMany({
      where: { id: id, org_id: session.user.org_id },
      data: { status: 'terminated' },
    })

    return NextResponse.json({ success: true, data: { message: 'Employee deactivated' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to deactivate employee' }, { status: 500 })
  }
}