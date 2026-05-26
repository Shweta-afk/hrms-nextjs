import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const payslip = await prisma.payslip.findFirst({
      where: { id, org_id: session.user.org_id },
    })

    if (!payslip) {
      return NextResponse.json({ success: false, error: 'Payslip not found' }, { status: 404 })
    }

    const updated = await prisma.payslip.update({
      where: { id },
      data: {
        hr_approved_by: session.user.id,
        hr_approved_at: new Date(),
        is_published: true,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to approve payslip' }, { status: 500 })
  }
}
