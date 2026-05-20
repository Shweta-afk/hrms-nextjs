import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/org/api-keys/[id]
 * Revoke (hard-delete) an API key. Immediate effect — any sync agent
 * using that key will receive 401 on the next request.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const key = await prisma.orgApiKey.findFirst({
      where: { id, org_id: session.user.org_id },
    })
    if (!key) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 })
    }

    await prisma.orgApiKey.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/org/api-keys/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to revoke API key' }, { status: 500 })
  }
}
