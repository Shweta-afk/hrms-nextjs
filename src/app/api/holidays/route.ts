import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const holidays = await prisma.holiday.findMany({
      where: {
        org_id: session.user.org_id,
        date: { gte: today },
      },
      orderBy: { date: 'asc' },
      take: 10,
    })

    // If no holidays in DB, return default Indian holidays
    if (holidays.length === 0) {
      const defaultHolidays = [
        { id: '1', name: 'Independence Day', date: new Date('2026-08-15'), type: 'national' },
        { id: '2', name: 'Gandhi Jayanti', date: new Date('2026-10-02'), type: 'national' },
        { id: '3', name: 'Diwali', date: new Date('2026-10-28'), type: 'national' },
        { id: '4', name: 'Christmas', date: new Date('2026-12-25'), type: 'optional' },
      ].filter(h => h.date >= today)

      return NextResponse.json({ success: true, data: defaultHolidays })
    }

    return NextResponse.json({ success: true, data: holidays })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch holidays' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { name, date, type } = await req.json()

    const holiday = await prisma.holiday.create({
      data: {
        org_id: session.user.org_id,
        name,
        date: new Date(date),
        type: type ?? 'national',
      },
    })

    return NextResponse.json({ success: true, data: holiday }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create holiday' }, { status: 500 })
  }
}