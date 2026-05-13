import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateEmployeeSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  department_id: z.string().optional(),
  designation_id: z.string().optional(),
  manager_id: z.string().optional(),
  date_of_joining: z.string(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']),
  essl_device_id: z.string().optional(),
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {
      org_id: session.user.org_id,
      ...(status && { status }),
      ...(department_id && { department_id }),
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
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = CreateEmployeeSchema.parse(body)

    // Auto-generate emp_code
    const count = await prisma.employee.count({
      where: { org_id: session.user.org_id },
    })
    const emp_code = `EMP${String(count + 1).padStart(4, '0')}`

    const employee = await prisma.employee.create({
      data: {
        ...data,
        org_id: session.user.org_id,
        emp_code,
        date_of_joining: new Date(data.date_of_joining),
      },
      include: {
        department: true,
        designation: true,
      },
    })

    // Auto-create user account for the employee
    const tempPassword = `Hrms@${Math.floor(1000 + Math.random() * 9000)}`
    const hashedPwd = await import('bcryptjs').then(b => b.hash(tempPassword, 10))

    const empUser = await prisma.user.create({
      data: {
        org_id: session.user.org_id,
        email: data.email,
        password: hashedPwd,
        role: 'employee',
        employee_id: employee.id,
      },
    })

    // TODO: Send welcome email via Resend with tempPassword
    console.log(`Employee login created: ${data.email} / ${tempPassword}`)
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
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 })
    }
    console.error('Employee POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create employee' }, { status: 500 })
  }
}




