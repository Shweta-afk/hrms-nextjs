import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const employee_id = searchParams.get('employee_id')

    // Find employee
    let empId = employee_id
    if (!empId) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { employee_id: true },
      })
      empId = user?.employee_id ?? null
    }

    if (!empId) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const currentYear = new Date().getFullYear()

    // Get all leave types for the org
    const leaveTypes = await prisma.leaveType.findMany({
      where: { org_id: session.user.org_id },
    })

    // Get approved leaves taken this year per type
    const takenLeaves = await prisma.leaveRequest.groupBy({
      by: ['leave_type_id'],
      where: {
        org_id: session.user.org_id,
        employee_id: empId,
        status: 'approved',
        from_date: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`),
        },
      },
      _sum: { total_days: true },
    })

    const takenMap = Object.fromEntries(
      takenLeaves.map(t => [t.leave_type_id, Number(t._sum.total_days ?? 0)])
    )

    const balances = leaveTypes.map(lt => ({
      leave_type_id: lt.id,
      name: lt.name,
      code: lt.code,
      total: Number(lt.days_per_year),
      taken: takenMap[lt.id] ?? 0,
      available: Number(lt.days_per_year) - (takenMap[lt.id] ?? 0),
      is_paid: lt.is_paid,
    }))

    return NextResponse.json({ success: true, data: balances })
  } catch (error) {
    console.error('Leave balance error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch leave balance' }, { status: 500 })
  }
}