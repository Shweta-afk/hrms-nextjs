import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeDecrypt, safeEncrypt } from '@/lib/encryption'
import { z } from 'zod'
const UpdateEmployeeSchema = z.object({
  // Self-service fields (employees can edit)
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  personal_info: z.record(z.string(), z.unknown()).optional(),
  contact_info: z.record(z.string(), z.unknown()).optional(),
  // Sensitive fields — accepted as plain objects, encrypted before storage
  bank_details: z.record(z.string(), z.unknown()).optional(),
  statutory_info: z.record(z.string(), z.unknown()).optional(),
  // HR-only fields (blocked for employees in the handler below)
  emp_code: z.string().optional(),
  date_of_joining: z.string().optional(),
  department_id: z.string().optional(),
  designation_id: z.string().optional(),
  manager_id: z.string().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  status: z.enum(['active', 'on_notice', 'terminated']).optional(),
  essl_device_id: z.string().nullable().optional(),
  salary_structure_id: z.string().nullable().optional(),
  ctc_annual: z.number().optional(),
  monthly_incentive: z.number().nullable().optional(),
  exclude_from_payroll: z.boolean().optional(),
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
      const forbidden = ['department_id','designation_id','manager_id','employment_type','status','salary_structure_id','ctc_annual','essl_device_id','date_of_joining','emp_code','exclude_from_payroll']
      for (const f of forbidden) {
        if (f in rest) return NextResponse.json({ success: false, error: `Field '${f}' cannot be changed by employees` }, { status: 403 })
      }
    }

    // Verify the employee belongs to this org before touching anything
    const existing = await prisma.employee.findFirst({
      where: { id: id, org_id: session.user.org_id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const updatePayload: Record<string, unknown> = { ...rest }
    if (bank_details !== undefined) updatePayload.bank_details = safeEncrypt(bank_details)
    if (statutory_info !== undefined) updatePayload.statutory_info = safeEncrypt(statutory_info)
    // Prisma DateTime fields require a Date object, not a raw string
    if (updatePayload.date_of_joining) {
      updatePayload.date_of_joining = new Date(updatePayload.date_of_joining as string)
    }

    // If there's nothing to update just return the current record
    if (Object.keys(updatePayload).length === 0) {
      const current = await prisma.employee.findFirst({
        where: { id: id },
        include: { department: true, designation: true },
      })
      return NextResponse.json({
        success: true,
        data: {
          ...current,
          bank_details: safeDecrypt(current!.bank_details),
          statutory_info: safeDecrypt(current!.statutory_info),
        },
      })
    }

    // Capture pre-update DOB so we can notify HR if it changed. Done BEFORE
    // the update so we have an honest "before" snapshot — pulling it after
    // would always equal the new value. Cheap because `existing` is already
    // in memory; we just dig into its JSON column.
    const oldPersonalInfo = (existing.personal_info ?? {}) as Record<string, unknown>
    const oldDob = typeof oldPersonalInfo.date_of_birth === 'string'
      ? oldPersonalInfo.date_of_birth : null

    const updated = await prisma.employee.update({
      where: { id: id },
      data: updatePayload,
      include: { department: true, designation: true },
    })

    // If email changed, keep the linked User account in sync
    if (updatePayload.email) {
      await prisma.user.updateMany({
        where: { employee_id: id, org_id: session.user.org_id },
        data: { email: updatePayload.email as string },
      }).catch(() => {})
    }

    // Notify HR when an EMPLOYEE (not HR themselves) sets or changes their
    // date of birth. Useful for two reasons: (a) HR can verify the DOB
    // against the employee's documents, and (b) HR sees the birthday panel
    // populate in real time as employees respond to the portal nudge.
    // We deliberately don't notify on HR's own edits — HR knows what they
    // did and doesn't need a notification about it.
    if (isEmployee) {
      const newPersonalInfo = (updated.personal_info ?? {}) as Record<string, unknown>
      const newDob = typeof newPersonalInfo.date_of_birth === 'string'
        ? newPersonalInfo.date_of_birth : null
      if (newDob !== oldDob) {
        try {
          const { notifyHRAdmins } = await import('@/lib/notifications')
          const fmt = (s: string | null) => {
            if (!s) return 'blank'
            const d = new Date(s)
            return isNaN(d.getTime())
              ? s
              : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
          }
          const empName = `${updated.first_name} ${updated.last_name}`.trim()
          const title   = oldDob ? 'Employee updated their date of birth' : 'Employee added their date of birth'
          const message = oldDob
            ? `${empName} changed their date of birth from ${fmt(oldDob)} to ${fmt(newDob)}. Verify against onboarding documents if needed.`
            : `${empName} added their date of birth: ${fmt(newDob)}. They will now appear on the upcoming-birthdays panel.`
          await notifyHRAdmins(
            session.user.org_id,
            title,
            message,
            oldDob ? 'warning' : 'info',
            `/employees/${id}?tab=personal`
          )
        } catch (notifyErr) {
          // Notification failure shouldn't fail the save — log and continue.
          console.error('DOB-change HR notification failed:', notifyErr)
        }
      }
    }

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
      const msg = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
      return NextResponse.json({ success: false, error: msg }, { status: 400 })
    }
    // Prisma unique-constraint violation. Most common case here is HR trying
    // to set an emp_code that another employee already uses — surface that as
    // a clear 409 instead of a generic 500.
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const target = (error as { meta?: { target?: string[] } }).meta?.target
      const fields = Array.isArray(target) ? target.join(', ') : 'field'
      const friendly = fields.includes('emp_code')
        ? 'That Employee ID is already in use by someone else in your org.'
        : `Duplicate value for ${fields}. This ${fields} is already in use.`
      return NextResponse.json({ success: false, error: friendly }, { status: 409 })
    }
    console.error('Employee PATCH error:', error)
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