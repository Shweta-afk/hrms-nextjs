import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
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
    console.error('Forgot password error:', error)
    return NextResponse.json({ success: false, error: 'Failed to send reset email' }, { status: 500 })
  }
}