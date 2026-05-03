import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const runs = await prisma.payrollRun.findMany({
      where: { org_id: session.user.org_id },
      include: {
        payslips: { select: { id: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return NextResponse.json({ success: true, data: runs })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch payroll runs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { month, year } = await req.json()

    // Check if run already exists
    const existing = await prisma.payrollRun.findUnique({
      where: {
        org_id_month_year: {
          org_id: session.user.org_id,
          month,
          year,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Payroll for ${month}/${year} already exists` },
        { status: 400 }
      )
    }

    const run = await prisma.payrollRun.create({
      data: {
        org_id: session.user.org_id,
        month,
        year,
        status: 'draft',
        run_by: session.user.id,
      },
    })

    return NextResponse.json({ success: true, data: run }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create payroll run' }, { status: 500 })
  }
}