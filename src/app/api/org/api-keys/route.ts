import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { randomBytes, createHash } from 'crypto'

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/**
 * GET /api/org/api-keys
 * List all API keys for the org (returns metadata — never the raw key).
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const keys = await prisma.orgApiKey.findMany({
      where: { org_id: session.user.org_id },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        last_used: true,
        is_active: true,
        created_at: true,
      },
    })

    return NextResponse.json({ success: true, data: keys })
  } catch (error) {
    console.error('GET /api/org/api-keys error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch API keys' }, { status: 500 })
  }
}

/**
 * POST /api/org/api-keys
 * Generate a new API key for the org.
 * The raw key is returned ONCE in the response — it is never stored.
 * Body: { name: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'hr_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { name } = await req.json()
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 })
    }

    const rawKey = `sk_live_${randomBytes(32).toString('hex')}`
    const keyHash = hashKey(rawKey)

    const apiKey = await prisma.orgApiKey.create({
      data: {
        org_id:   session.user.org_id,
        name:     name.trim(),
        key_hash: keyHash,
      },
      select: { id: true, name: true, created_at: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...apiKey,
        // Raw key shown ONCE — store it securely, it cannot be retrieved later
        raw_key: rawKey,
      },
    })
  } catch (error) {
    console.error('POST /api/org/api-keys error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate API key' }, { status: 500 })
  }
}
