import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const employee_id = searchParams.get('employee_id')
    const page = parseInt(searchParams.get('page') || '1')
    // Employees can only ever see their own attendance, regardless of the employee_id
    // they pass in the query. Admins can filter by any employee_id, or see all.
    const isEmployee = session.user.role === 'employee'
    const maxLimit = isEmployee ? 200 : 5000
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), maxLimit)
    const scopedEmployeeId = isEmployee
      ? session.user.employee_id
      : employee_id

    if (isEmployee && !session.user.employee_id) {
      return NextResponse.json({ success: false, error: 'No employee record linked' }, { status: 403 })
    }

    const where: any = {
      org_id: session.user.org_id,
      ...(scopedEmployeeId && { employee_id: scopedEmployeeId }),
      ...(date && { date: new Date(date) }),
      ...(month && year && {
        date: {
          gte: new Date(`${year}-${month.padStart(2, '0')}-01`),
          lte: new Date(`${year}-${month.padStart(2, '0')}-31`),
        },
      }),
    }

    const [records, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              emp_code: true,
              essl_device_id: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { employee: { first_name: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendanceRecord.count({ where }),
    ])

    // Today's summary
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [presentToday, absentToday, lateToday] = await Promise.all([
      prisma.attendanceRecord.count({
        where: { org_id: session.user.org_id, date: today, status: 'present' },
      }),
      prisma.attendanceRecord.count({
        where: { org_id: session.user.org_id, date: today, status: 'absent' },
      }),
      prisma.attendanceRecord.count({
        where: { org_id: session.user.org_id, date: today, is_late: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        records,
        total,
        page,
        pages: Math.ceil(total / limit),
        summary: { present: presentToday, absent: absentToday, late: lateToday },
      },
    })
  } catch (error) {
    console.error('Attendance GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Manual attendance entry — admin-only.
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json()
    const { employee_id, date, first_in, last_out, status, source = 'manual' } = body

    const dateObj = new Date(date)
    const firstInObj = first_in ? new Date(first_in) : null
    const lastOutObj = last_out ? new Date(last_out) : null

    // Calculate hours and late status
    let totalHours = null
    let isLate = false
    let lateByMinutes = 0

    if (firstInObj && lastOutObj) {
      totalHours = (lastOutObj.getTime() - firstInObj.getTime()) / (1000 * 60 * 60)
    }

    // Late if check-in after 9:15 AM
    if (firstInObj) {
      const shiftStart = new Date(firstInObj)
      shiftStart.setHours(9, 15, 0, 0)
      if (firstInObj > shiftStart) {
        isLate = true
        lateByMinutes = Math.floor((firstInObj.getTime() - shiftStart.getTime()) / 60000)
      }
    }

    const record = await prisma.attendanceRecord.upsert({
      where: {
        org_id_employee_id_date: {
          org_id: session.user.org_id,
          employee_id,
          date: dateObj,
        },
      },
      update: {
        first_in: firstInObj,
        last_out: lastOutObj,
        total_hours: totalHours,
        status: status || (firstInObj ? 'present' : 'absent'),
        is_late: isLate,
        late_by_minutes: lateByMinutes,
        source,
      },
      create: {
        org_id: session.user.org_id,
        employee_id,
        date: dateObj,
        first_in: firstInObj,
        last_out: lastOutObj,
        total_hours: totalHours,
        status: status || (firstInObj ? 'present' : 'absent'),
        is_late: isLate,
        late_by_minutes: lateByMinutes,
        source,
      },
    })

    return NextResponse.json({ success: true, data: record }, { status: 201 })
  } catch (error) {
    console.error('Attendance POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save attendance' }, { status: 500 })
  }
}