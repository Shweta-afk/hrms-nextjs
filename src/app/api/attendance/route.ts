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

    const nowUTC = new Date()
    const todayUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate()))

    const reqMonth = month ? parseInt(month) : null
    const reqYear  = year  ? parseInt(year)  : null

    // Active payroll-included headcount (needed for both paths)
    const totalActive = await prisma.employee.count({
      where: { org_id: session.user.org_id, status: 'active', exclude_from_payroll: false },
    })

    let summaryPresent: number, summaryAbsent: number, summaryLate: number

    if (reqMonth != null && reqYear != null) {
      // ── Monthly aggregate summary ─────────────────────────────────────────
      // Used by the dashboard chart — returns employee-days present/absent so
      // present/(present+absent) gives the monthly attendance rate.
      const monthStart  = new Date(Date.UTC(reqYear, reqMonth - 1, 1))
      const monthEnd    = new Date(Date.UTC(reqYear, reqMonth, 0))       // last day of month
      const effectiveEnd = monthEnd < todayUTC ? monthEnd : todayUTC     // don't peek into the future

      // Read org work-day config so Saturday/Sunday are counted correctly
      const orgSettings = (await prisma.organisation.findFirst({
        where: { id: session.user.org_id },
        select: { settings: true },
      }))?.settings as Record<string, unknown> | null ?? {}
      const workDayArr = (orgSettings?.work_days as number[] | undefined)
        ?? [1, 2, 3, 4, 5, 6]   // Mon-Sat default
      const workDaySet = new Set(workDayArr)

      let workingDays = 0
      const d = new Date(monthStart)
      while (d <= effectiveEnd) {
        if (workDaySet.has(d.getUTCDay())) workingDays++
        d.setUTCDate(d.getUTCDate() + 1)
      }

      const [presentCount, lateCount] = await Promise.all([
        prisma.attendanceRecord.count({
          where: {
            org_id: session.user.org_id,
            date: { gte: monthStart, lte: effectiveEnd },
            status: { in: ['present', 'late', 'half_day', 'wfh'] },
            employee: { status: 'active', exclude_from_payroll: false },
          },
        }),
        prisma.attendanceRecord.count({
          where: {
            org_id: session.user.org_id,
            date: { gte: monthStart, lte: effectiveEnd },
            is_late: true,
            employee: { status: 'active', exclude_from_payroll: false },
          },
        }),
      ])

      const totalExpected = totalActive * workingDays
      summaryPresent = presentCount
      summaryAbsent  = Math.max(0, totalExpected - presentCount)
      summaryLate    = lateCount
    } else {
      // ── Today's summary ───────────────────────────────────────────────────
      const [presentToday, lateToday] = await Promise.all([
        prisma.attendanceRecord.count({
          where: {
            org_id: session.user.org_id,
            date: todayUTC,
            status: { in: ['present', 'late', 'half_day', 'wfh'] },
            employee: { status: 'active', exclude_from_payroll: false },
          },
        }),
        prisma.attendanceRecord.count({
          where: {
            org_id: session.user.org_id,
            date: todayUTC,
            is_late: true,
            employee: { status: 'active', exclude_from_payroll: false },
          },
        }),
      ])
      summaryPresent = presentToday
      summaryAbsent  = Math.max(0, totalActive - presentToday)
      summaryLate    = lateToday
    }

    return NextResponse.json({
      success: true,
      data: {
        records,
        total,
        page,
        pages: Math.ceil(total / limit),
        summary: { present: summaryPresent, absent: summaryAbsent, late: summaryLate },
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
    const { employee_id, date, first_in, last_out, status, correction_reason, source = 'manual' } = body

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
        is_corrected: true,
        ...(correction_reason && { correction_reason }),
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
        is_corrected: true,
        ...(correction_reason && { correction_reason }),
      },
    })

    return NextResponse.json({ success: true, data: record }, { status: 201 })
  } catch (error) {
    console.error('Attendance POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save attendance' }, { status: 500 })
  }
}