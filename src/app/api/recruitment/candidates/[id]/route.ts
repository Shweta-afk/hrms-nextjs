import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { stage, ai_score, ai_summary, ...rest } = body

    const candidate = await prisma.candidate.updateMany({
      where: { id: params.id, org_id: session.user.org_id },
      data: {
        ...(stage && { stage }),
        ...(ai_score !== undefined && { ai_score }),
        ...(ai_summary && { ai_summary }),
        ...rest,
      },
    })

    return NextResponse.json({ success: true, data: candidate })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update candidate' }, { status: 500 })
  }
}