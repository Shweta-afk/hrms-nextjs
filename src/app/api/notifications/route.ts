import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const where = { org_id: session.user.org_id, user_id: session.user.id }
    const [notifications, unread_count] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      prisma.notification.count({ where: { ...where, is_read: false } }),
    ])

    return NextResponse.json({
      success: true,
      data: { notifications, unread_count },
    })
  } catch (error) {
    console.error('Notifications error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await prisma.notification.updateMany({
      where: {
        org_id: session.user.org_id,
        user_id: session.user.id,
        is_read: false,
      },
      data: { is_read: true },
    })

    return NextResponse.json({
      success: true,
      data: { message: 'All notifications marked as read' },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}