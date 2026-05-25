import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { BCRYPT_COST } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json()

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: {
        reset_token: token,
        reset_token_expiry: { gt: new Date() },
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset link' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
      },
    })

    return NextResponse.json({ success: true, data: { message: 'Password reset successfully' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to reset password' }, { status: 500 })
  }
}