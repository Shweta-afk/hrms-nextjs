import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateJobSchema = z.object({
  title: z.string().min(1),
  department: z.string().min(1),
  location: z.string().min(1),
  openings: z.number().min(1).default(1),
  description: z.string().min(1),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const jobs = await prisma.jobPosting.findMany({
      where: { org_id: session.user.org_id },
      include: {
        candidates: { select: { id: true, stage: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ success: true, data: jobs })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json()
    const data = CreateJobSchema.parse(body)

    const job = await prisma.jobPosting.create({
      data: {
        org_id: session.user.org_id,
        ...data,
        status: 'open',
      },
    })

    const { notifyHRAdmins } = await import('@/lib/notifications')
    await notifyHRAdmins(
      session.user.org_id,
      'New Job Posted',
      `${data.title} has been posted with ${data.openings} opening(s).`,
      'info'
    )

    return NextResponse.json({ success: true, data: job }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to create job' }, { status: 500 })
  }
}