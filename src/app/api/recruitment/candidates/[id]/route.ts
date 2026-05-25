import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// EXPLICIT allow-list — never spread raw body into Prisma data, otherwise an
// admin can pass `{ org_id: '<other-tenant>' }` and move records between tenants.
const UpdateCandidateSchema = z.object({
  name:             z.string().min(1).optional(),
  email:            z.string().email().optional(),
  phone:            z.string().optional().nullable(),
  current_company:  z.string().optional().nullable(),
  experience_years: z.number().int().optional().nullable(),
  stage:            z.string().optional(),
  ai_score:         z.number().int().optional().nullable(),
  ai_summary:       z.string().optional().nullable(),
  resume_url:       z.string().optional().nullable(),
  source:           z.string().optional(),
}).strict()  // .strict() = reject unknown keys instead of silently dropping

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
    const parsed = UpdateCandidateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body' },
        { status: 400 }
      )
    }

    // Scope by org_id at write time — defense in depth even though .strict() blocks
    // org_id smuggling.
    const result = await prisma.candidate.updateMany({
      where: { id, org_id: session.user.org_id },
      data: parsed.data,
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 })
    }

    const candidate = await prisma.candidate.findFirst({
      where: { id, org_id: session.user.org_id },
      include: { job_posting: { select: { title: true } } },
    })

    return NextResponse.json({ success: true, data: candidate })
  } catch (error) {
    console.error('PATCH /api/recruitment/candidates/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update candidate' }, { status: 500 })
  }
}
