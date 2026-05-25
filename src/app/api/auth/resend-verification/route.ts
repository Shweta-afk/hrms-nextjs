import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import crypto from 'crypto'

/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 *
 * Generates a fresh verification token + 24h expiry and emails it.
 * Always returns success — even for unknown emails — to prevent enumeration.
 * Rate-limited per IP (5 per 15 minutes).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = await checkRateLimit(`resend-verify:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 })
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a few minutes.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const { email } = await req.json().catch(() => ({}))
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 })
    }

    // Generic success reply (don't leak whether email exists)
    const GENERIC = NextResponse.json({
      success: true,
      data: { message: 'If an unverified account exists for this email, a new verification link has been sent.' },
    })

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organisation: { select: { name: true } } },
    })

    // Silently skip if: no such user, already verified, or inactive
    if (!user || user.email_verified_at || !user.is_active) {
      return GENERIC
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    await prisma.user.update({
      where: { id: user.id },
      data: {
        email_verification_token: token,
        email_verification_expiry: expiry,
      },
    })

    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/verify-email?token=${token}`

    try {
      const { sendVerificationEmail } = await import('@/lib/email')
      await sendVerificationEmail({
        to: email,
        name: email.split('@')[0],
        verifyUrl,
        company: user.organisation.name,
      })
    } catch (emailErr) {
      // Log but still return generic success so the response shape doesn't leak existence.
      console.error('Failed to send verification email:', emailErr)
    }

    return GENERIC
  } catch (error) {
    console.error('resend-verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}
