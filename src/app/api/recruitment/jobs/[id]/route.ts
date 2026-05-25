import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Allow-list — see candidates/[id]/route.ts for rationale.
const UpdateJobSchema = z.object({
  title:       z.string().min(1).optional(),
  department:  z.string().min(1).optional(),
  location:    z.string().min(1).optional(),
  openings:    z.number().int().min(0).optional(),
  description: z.string().min(1).optional(),
  status:      z.enum(['open', 'closed', 'on_hold']).optional(),
}).strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const body = await req.json()
    const parsed = UpdateJobSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body' },
        { status: 400 }
      )
    }

    const result = await prisma.jobPosting.updateMany({
      where: { id, org_id: session.user.org_id },
      data: parsed.data,
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    const job = await prisma.jobPosting.findFirst({
      where: { id, org_id: session.user.org_id },
    })

    return NextResponse.json({ success: true, data: job })
  } catch (error) {
    console.error('PATCH /api/recruitment/jobs/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update job' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard
    const session = guard

    const result = await prisma.jobPosting.updateMany({
      where: { id, org_id: session.user.org_id },
      data: { status: 'closed' },
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { message: 'Job closed' } })
  } catch (error) {
    console.error('DELETE /api/recruitment/jobs/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to close job' }, { status: 500 })
  }
}
