import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const CreateCandidateSchema = z.object({
  job_posting_id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  current_company: z.string().optional(),
  experience_years: z.number().optional(),
  source: z.string().default('website'),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const job_posting_id = searchParams.get('job_posting_id')

    const candidates = await prisma.candidate.findMany({
      where: {
        org_id: session.user.org_id,
        ...(job_posting_id && { job_posting_id }),
      },
      include: {
        job_posting: { select: { title: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ success: true, data: candidates })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch candidates' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = CreateCandidateSchema.parse(body)

    const candidate = await prisma.candidate.create({
      data: {
        org_id: session.user.org_id,
        ...data,
        stage: 'applied',
      },
    })

    return NextResponse.json({ success: true, data: candidate }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to add candidate' }, { status: 500 })
  }
}