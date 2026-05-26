import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const isEmployee = session.user.role === 'employee'

    const where: any = {
      org_id: session.user.org_id,
      ...(status && { status }),
      ...(isEmployee && { employee_id: session.user.employee_id }),
    }

    const reimbursements = await prisma.reimbursement.findMany({
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
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ success: true, data: reimbursements })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch reimbursements' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth()
    if (guard instanceof NextResponse) return guard
    const session = guard

    // Employees can only create for themselves; HR admins can create for any employee
    const isEmployee = session.user.role === 'employee'
    if (isEmployee && !session.user.employee_id) {
      return NextResponse.json({ success: false, error: 'No employee record linked to your account' }, { status: 403 })
    }

    const body = await req.json()
    const { title, description, amount, bill_url, employee_id } = body

    if (!title || amount === undefined || amount === null) {
      return NextResponse.json({ success: false, error: 'title and amount are required' }, { status: 400 })
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be a positive number' }, { status: 400 })
    }

    // For employees, always use their own employee_id
    // For HR admins, use the provided employee_id or fall back to their own if they have one
    const targetEmployeeId = isEmployee
      ? session.user.employee_id!
      : (employee_id ?? session.user.employee_id)

    if (!targetEmployeeId) {
      return NextResponse.json({ success: false, error: 'employee_id is required' }, { status: 400 })
    }

    const reimbursement = await prisma.reimbursement.create({
      data: {
        org_id: session.user.org_id,
        employee_id: targetEmployeeId,
        title,
        description: description ?? null,
        amount: parsedAmount,
        bill_url: bill_url ?? null,
        status: 'pending',
      },
      include: {
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            emp_code: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: reimbursement }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create reimbursement' }, { status: 500 })
  }
}
