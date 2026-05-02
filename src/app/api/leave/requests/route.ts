import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateLeaveSchema = z.object({
  leave_type_id: z.string(),
  from_date: z.string(),
  to_date: z.string(),
  reason: z.string().min(1),
  employee_id: z.string().optional(),
})

function getWorkingDays(from: Date, to: Date): number {
  let count = 0
  const cur = new Date(from)
  while (cur <= to) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const employee_id = searchParams.get('employee_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {
      org_id: session.user.org_id,
      ...(status && { status }),
      // Employees only see their own requests
      ...(session.user.role === 'employee' && {
        employee: { user: { id: session.user.id } }
      }),
      // HR/manager can filter by employee
      ...(employee_id && session.user.role !== 'employee' && { employee_id }),
    }

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              emp_code: true,
              department: { select: { name: true } },
            },
          },
          leave_type: true,
          approver: {
            select: { id: true, email: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: { requests, total, page, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Leave requests GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch leave requests' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = CreateLeaveSchema.parse(body)

    // Find the employee record for this user
    let employee_id = data.employee_id

    if (!employee_id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { employee_id: true },
      })
      if (!user?.employee_id) {
        return NextResponse.json(
          { success: false, error: 'No employee record found for this user' },
          { status: 400 }
        )
      }
      employee_id = user.employee_id
    }

    const fromDate = new Date(data.from_date)
    const toDate = new Date(data.to_date)

    if (fromDate > toDate) {
      return NextResponse.json(
        { success: false, error: 'From date cannot be after to date' },
        { status: 400 }
      )
    }

    const totalDays = getWorkingDays(fromDate, toDate)

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        org_id: session.user.org_id,
        employee_id,
        leave_type_id: data.leave_type_id,
        from_date: fromDate,
        to_date: toDate,
        total_days: totalDays,
        reason: data.reason,
        status: 'pending',
      },
      include: {
        employee: {
          select: { first_name: true, last_name: true },
        },
        leave_type: true,
      },
    })

    // Notify HR admins
    const { notifyHRAdmins } = await import('@/lib/notifications')
    await notifyHRAdmins(
      session.user.org_id,
      'New Leave Request',
      `${leaveRequest.employee.first_name} ${leaveRequest.employee.last_name} has requested ${totalDays} day(s) of ${leaveRequest.leave_type.name}.`,
      'info',
      '/leave'
    )

    return NextResponse.json({ success: true, data: leaveRequest }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 })
    }
    console.error('Leave request POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create leave request' }, { status: 500 })
  }
}