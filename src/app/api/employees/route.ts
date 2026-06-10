import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateEmployeeSchema = z.object({
  first_name:       z.string().min(1),
  last_name:        z.string().min(1),
  email:            z.string().email(),
  phone:            z.string().optional(),
  emp_code:         z.string().optional(),   // HR can supply; auto-generated if blank
  department_id:    z.string().optional(),
  designation_id:   z.string().optional(),
  manager_id:       z.string().optional(),
  date_of_joining:  z.string(),
  employment_type:  z.enum(['full_time', 'part_time', 'contract', 'intern']),
  essl_device_id:   z.string().optional(),
  ctc_annual:       z.number().optional(),
  // Free-form JSON for personal info (date_of_birth, gender, marital status,
  // addresses, blood group, emergency contact). HR's Add Employee form
  // currently sends only date_of_birth here; the employee can fill the rest
  // from their own portal. Loose schema so the field stays extensible
  // without requiring a code change on every new sub-field.
  personal_info:    z.record(z.string(), z.unknown()).optional(),
})

// GET — list all employees
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const department_id = searchParams.get('department_id')
    const status = searchParams.get('status')
    const payrollOnly = searchParams.get('payroll_only') === 'true'
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 200)
    const skip = (page - 1) * limit

    const where: any = {
      org_id: session.user.org_id,
      // 'archive' = show both terminated + resigned. Default hides both from active list.
      ...(status === 'archive'
        ? { status: { in: ['terminated', 'resigned'] } }
        : status
          ? { status }
          : { status: { notIn: ['terminated', 'resigned'] } }
      ),
      ...(department_id && { department_id }),
      // Pass ?payroll_only=true to exclude employees marked "exclude from payroll"
      ...(payrollOnly && { exclude_from_payroll: false }),
      ...(search && {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { emp_code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          department: true,
          designation: true,
          manager: {
            select: { id: true, first_name: true, last_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        employees,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Employees GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch employees' }, { status: 500 })
  }
}

// POST — create employee
export async function POST(req: NextRequest) {
  try {
    // Only HR admins can create employees.
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json()
    const data = CreateEmployeeSchema.parse(body)
    const email = data.email.trim().toLowerCase()

    // Pre-check: is this email already in use by another user?
    // The `users.email` column is UNIQUE, so without this guard the insert
    // would still fail downstream — but with a generic "Failed to create
    // employee" message that hides the real cause from HR.
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'A user with this email already exists. Use a different email or remove the existing account first.',
        },
        { status: 409 }
      )
    }

    // Use HR-provided emp_code if given, otherwise auto-generate
    const count = await prisma.employee.count({
      where: { org_id: session.user.org_id },
    })
    const emp_code = data.emp_code?.trim() || `EMP${String(count + 1).padStart(4, '0')}`

    // Hash password BEFORE the transaction so bcrypt's ~65ms doesn't hold a
    // DB transaction open.
    const tempPassword = `Hrms@${Math.floor(1000 + Math.random() * 9000)}`
    const bcrypt = await import('bcryptjs')
    const hashedPwd = await bcrypt.hash(tempPassword, 10)

    // Pull personal_info out of `data` so the generic `...data` spread
    // doesn't re-introduce the broader Record<string, unknown> type that
    // Prisma's strict JSON input rejects.
    const { personal_info, ...rest } = data

    // Atomic: create the Employee + linked User together. If either fails,
    // BOTH roll back — no orphan Employee rows when the User insert errors.
    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          ...rest,
          email,
          org_id: session.user.org_id,
          emp_code,
          date_of_joining: new Date(data.date_of_joining),
          // Prisma's InputJsonValue is structurally narrower than zod's
          // Record<string, unknown>. Cast at the boundary — zod has
          // already validated the shape, and the DB column is
          // `Json @default("{}")` so the runtime contract is permissive.
          ...(personal_info && { personal_info: personal_info as any }),
        },
        include: {
          department: true,
          designation: true,
        },
      })

      await tx.user.create({
        data: {
          org_id: session.user.org_id,
          email,
          password: hashedPwd,
          role: 'employee',
          employee_id: emp.id,
          // HR vouches for this employee — mark them verified so they can
          // log in immediately with the temp password sent in the welcome
          // email. Without this, NextAuth's authorize() throws
          // EMAIL_NOT_VERIFIED and the employee is permanently locked out.
          email_verified_at: new Date(),
        },
      })

      return emp
    })

    // Send welcome email
    try {
      const { sendWelcomeEmail } = await import('@/lib/email')
      const org = await prisma.organisation.findUnique({ where: { id: session.user.org_id } })
      await sendWelcomeEmail({
        to: data.email,
        name: `${data.first_name} ${data.last_name}`,
        company: org?.name ?? 'Your Company',
        tempPassword,
      })
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr)
      // Don't fail the request if email fails
    }

    // Notify HR admins
    const { notifyHRAdmins } = await import('@/lib/notifications')
    await notifyHRAdmins(
      session.user.org_id,
      'New Employee Added',
      `${employee.first_name} ${employee.last_name} has been added as ${employee.employment_type.replace('_', ' ')}.`,
      'info'
    )

    return NextResponse.json({ success: true, data: employee }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Surface validation issues so HR can see WHICH field is wrong.
      const firstIssue = error.issues[0]
      const fieldPath = firstIssue?.path?.join('.') ?? 'field'
      const message = firstIssue
        ? `${fieldPath}: ${firstIssue.message}`
        : 'Invalid input'
      return NextResponse.json(
        { success: false, error: message, issues: error.issues },
        { status: 400 }
      )
    }
    // Prisma unique-constraint violation (race with another HR adding the
    // same email at the same time, or a stale row our pre-check missed).
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const target = (error as { meta?: { target?: string[] } }).meta?.target
      const field = Array.isArray(target) ? target.join(', ') : 'field'
      return NextResponse.json(
        {
          success: false,
          error: `Duplicate value for ${field}. This ${field} is already in use.`,
        },
        { status: 409 }
      )
    }
    console.error('Employee POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}




