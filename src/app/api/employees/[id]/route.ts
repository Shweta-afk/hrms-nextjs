import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeDecrypt, safeEncrypt } from '@/lib/encryption'
import { z } from 'zod'
const UpdateEmployeeSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  department_id: z.string().optional(),
  designation_id: z.string().optional(),
  manager_id: z.string().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  status: z.enum(['active', 'on_notice', 'terminated']).optional(),
  personal_info: z.record(z.string(), z.unknown()).optional(),
  contact_info: z.record(z.string(), z.unknown()).optional(),
  essl_device_id: z.string().optional(),
  salary_structure_id: z.string().optional(),
  ctc_annual: z.number().optional(),
  exclude_from_payroll: z.boolean().optional(),
  // Sensitive fields — accepted as plain objects, encrypted before storage
  bank_details: z.record(z.string(), z.unknown()).optional(),
  statutory_info: z.record(z.string(), z.unknown()).optional(),
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

    // Employees can only fetch their own record
    if (session.user.role === 'employee' && session.user.employee_id !== id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
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
          include: { leave_type: true },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
        attendance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        payslips: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 12,
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    // Decrypt sensitive fields before returning
    const data = {
      ...employee,
      bank_details: safeDecrypt(employee.bank_details),
      statutory_info: safeDecrypt(employee.statutory_info),
    }

    return NextResponse.json({ success: true, data })
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

    // Employees can only edit their own record, and only self-service fields
    const isEmployee = session.user.role === 'employee'
    if (isEmployee && session.user.employee_id !== id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { bank_details, statutory_info, ...rest } = UpdateEmployeeSchema.parse(body)

    // Employees cannot change HR-controlled fields
    if (isEmployee) {
      const forbidden = ['department_id','designation_id','manager_id','employment_type','status','salary_structure_id','ctc_annual','essl_device_id']
      for (const f of forbidden) {
        if (f in rest) return NextResponse.json({ success: false, error: `Field '${f}' cannot be changed by employees` }, { status: 403 })
      }
    }

    const updatePayload: Record<string, unknown> = { ...rest }
    if (bank_details !== undefined) updatePayload.bank_details = safeEncrypt(bank_details)
    if (statutory_info !== undefined) updatePayload.statutory_info = safeEncrypt(statutory_info)

    const result = await prisma.employee.updateMany({
      where: { id: id, org_id: session.user.org_id },
      data: updatePayload,
    })

    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    // If email changed, keep the linked User account in sync
    if (updatePayload.email) {
      await prisma.user.updateMany({
        where: { employee_id: id, org_id: session.user.org_id },
        data: { email: updatePayload.email as string },
      }).catch(() => {}) // ignore if no linked user yet
    }

    const updated = await prisma.employee.findFirst({
      where: { id: id },
      include: { department: true, designation: true },
    })

    if (!updated) return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        bank_details: safeDecrypt(updated.bank_details),
        statutory_info: safeDecrypt(updated.statutory_info),
      },
    })
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
    // Only HR admins can deactivate employees.
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const result = await prisma.employee.updateMany({
      where: { id: id, org_id: session.user.org_id },
      data: { status: 'terminated' },
    })
    if (result.count === 0) {
      // Either the UUID doesn't exist OR it belongs to another tenant — return 404
      // either way so we don't reveal which.
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { message: 'Employee deactivated' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to deactivate employee' }, { status: 500 })
  }
}