import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// Employees self-mark a present/late day as half_day via the portal.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    if (!session.user.employee_id) {
      return NextResponse.json({ success: false, error: 'No employee profile linked' }, { status: 403 })
    }

    const { attendance_id } = await req.json()

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        id: attendance_id,
        employee_id: session.user.employee_id,
        org_id:      session.user.org_id,
      },
    })
    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 })
    }
    if (!['present', 'late'].includes(record.status)) {
      return NextResponse.json(
        { success: false, error: 'Only present or late days can be marked as half day' },
        { status: 400 }
      )
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: attendance_id },
      data: {
        status: 'half_day',
        is_corrected: true,
        correction_reason: 'Employee self-marked half day via portal',
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to mark half day' }, { status: 500 })
  }
}
