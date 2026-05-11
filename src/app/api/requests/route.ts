import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { type, subject, description } = await req.json()

    if (!type || !subject || !description) {
      return NextResponse.json({ success: false, error: 'All fields required' }, { status: 400 })
    }

    // Store as a notification to HR admins
    const { notifyHRAdmins } = await import('@/lib/notifications')
    await notifyHRAdmins(
      session.user.org_id,
      `New Request: ${type}`,
      `${subject} — ${description.slice(0, 100)}`,
      'info'
    )

    return NextResponse.json({
      success: true,
      data: { message: 'Request submitted successfully. HR will get back to you shortly.' }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to submit request' }, { status: 500 })
  }
}