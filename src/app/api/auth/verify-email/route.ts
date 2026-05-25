import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/auth/verify-email
 * Body: { token: string }
 *
 * Marks the user with this verification token as verified, then clears the token.
 * Token expires 24 hours after issue.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json().catch(() => ({}))

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing verification token' },
        { status: 400 }
      )
    }

    // Find an unverified user with this token whose expiry is still in the future
    const user = await prisma.user.findFirst({
      where: {
        email_verification_token: token,
        email_verification_expiry: { gt: new Date() },
      },
      select: { id: true, email_verified_at: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification link' },
        { status: 400 }
      )
    }

    // Idempotent: if somehow already verified, just clear the token and succeed
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email_verified_at: user.email_verified_at ?? new Date(),
        email_verification_token: null,
        email_verification_expiry: null,
      },
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Email verified — you can now sign in.' },
    })
  } catch (error) {
    console.error('verify-email error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify email' },
      { status: 500 }
    )
  }
}
