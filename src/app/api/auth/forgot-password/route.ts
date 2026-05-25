import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = await checkRateLimit(`forgot:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 })
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a few minutes.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const { email } = await req.json()

    const user = await prisma.user.findUnique({ where: { email } })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true, data: { message: 'If this email exists, a reset link has been sent.' } })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { reset_token: token, reset_token_expiry: expiry },
    })

    const org = await prisma.organisation.findUnique({ where: { id: user.org_id } })
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`

    const { sendPasswordResetEmail } = await import('@/lib/email')
    await sendPasswordResetEmail({
      to: email,
      name: email.split('@')[0],
      resetUrl,
      company: org?.name ?? 'HRMS',
    })

    return NextResponse.json({ success: true, data: { message: 'Reset link sent to your email.' } })
  } catch (error) {
    logger.error('forgot_password_failed', error)
    return NextResponse.json({ success: false, error: 'Failed to send reset email' }, { status: 500 })
  }
}