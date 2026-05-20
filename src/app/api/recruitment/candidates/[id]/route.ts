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
    const { stage, ai_score, ai_summary, ...rest } = body

    const existing = await prisma.candidate.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 })
    }

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        ...(stage && { stage }),
        ...(ai_score !== undefined && { ai_score }),
        ...(ai_summary && { ai_summary }),
        ...rest,
      },
      include: { job_posting: { select: { title: true } } },
    })

    return NextResponse.json({ success: true, data: candidate })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update candidate' }, { status: 500 })
  }
}