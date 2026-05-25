import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

// Allow-list — see candidates/[id]/route.ts for rationale.
const UpdateStructureSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  components:  z.array(z.record(z.string(), z.unknown())).optional(),
  is_default:  z.boolean().optional(),
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
    const parsed = UpdateStructureSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body' },
        { status: 400 }
      )
    }

    if (parsed.data.is_default) {
      await prisma.salaryStructure.updateMany({
        where: { org_id: session.user.org_id, is_default: true },
        data: { is_default: false },
      })
    }

    // Prisma's typed JSON field doesn't accept our generic Record array — narrow it.
    const updateData: Prisma.SalaryStructureUpdateManyMutationInput = {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.components !== undefined && { components: parsed.data.components as Prisma.InputJsonValue }),
      ...(parsed.data.is_default !== undefined && { is_default: parsed.data.is_default }),
    }

    const result = await prisma.salaryStructure.updateMany({
      where: { id, org_id: session.user.org_id },
      data: updateData,
    })
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Structure not found' }, { status: 404 })
    }

    const structure = await prisma.salaryStructure.findFirst({
      where: { id, org_id: session.user.org_id },
    })

    return NextResponse.json({ success: true, data: structure })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update structure' }, { status: 500 })
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

    // Scope by org_id — admins must not be able to delete structures in other tenants.
    const result = await prisma.salaryStructure.deleteMany({
      where: { id, org_id: session.user.org_id },
    })

    if (result.count === 0) {
      return NextResponse.json({ success: false, error: 'Structure not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { message: 'Structure deleted' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete structure' }, { status: 500 })
  }
}
