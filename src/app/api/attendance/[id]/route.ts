import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { first_in, last_out, status, correction_reason } = body

    const firstInObj = first_in ? new Date(first_in) : undefined
    const lastOutObj = last_out ? new Date(last_out) : undefined

    let totalHours = undefined
    if (firstInObj && lastOutObj) {
      totalHours = (lastOutObj.getTime() - firstInObj.getTime()) / (1000 * 60 * 60)
    }

    const record = await prisma.attendanceRecord.update({
      where: { id: id, org_id: session.user.org_id },
      data: {
        ...(firstInObj && { first_in: firstInObj }),
        ...(lastOutObj && { last_out: lastOutObj }),
        ...(totalHours !== undefined && { total_hours: totalHours }),
        ...(status && { status }),
        ...(correction_reason && { correction_reason, is_corrected: true }),
      },
    })

    return NextResponse.json({ success: true, data: record })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update attendance' }, { status: 500 })
  }
}