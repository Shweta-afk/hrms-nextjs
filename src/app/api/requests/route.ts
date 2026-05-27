import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — HR sees all requests, employee sees their own
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))
    const skip   = (page - 1) * limit

    const where: Record<string, unknown> = { org_id: session.user.org_id }
    if (status && status !== 'all') where.status = status
    if (session.user.role === 'employee') {
      where.employee_id = session.user.employee_id
    }

    const [requests, total] = await Promise.all([
      prisma.hRRequest.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          employee: {
            select: { id: true, first_name: true, last_name: true, emp_code: true,
              department: { select: { name: true } } },
          },
        },
      }),
      prisma.hRRequest.count({ where }),
    ])

    return NextResponse.json({ success: true, data: { requests, total, page, limit } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 })
  }
}

// POST — employee submits a request
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { type, subject, description } = await req.json()

    if (!type || !subject || !description) {
      return NextResponse.json({ success: false, error: 'All fields required' }, { status: 400 })
    }

    if (!session.user.employee_id) {
      return NextResponse.json({ success: false, error: 'No employee profile linked' }, { status: 400 })
    }

    const request = await prisma.hRRequest.create({
      data: {
        org_id:      session.user.org_id,
        employee_id: session.user.employee_id,
        type,
        subject,
        description,
        status: 'open',
      },
    })

    // Notify HR admins
    const { notifyHRAdmins } = await import('@/lib/notifications')
    await notifyHRAdmins(
      session.user.org_id,
      `New Request: ${type}`,
      `${subject} — ${description.slice(0, 100)}`,
      'info'
    )

    return NextResponse.json({
      success: true,
      data: { ...request, message: 'Request submitted. HR will respond shortly.' },
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to submit request' }, { status: 500 })
  }
}
