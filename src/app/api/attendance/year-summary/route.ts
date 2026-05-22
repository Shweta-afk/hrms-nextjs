import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

    const from = new Date(Date.UTC(year, 0, 1))
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59))

    const records = await prisma.attendanceRecord.findMany({
      where: { org_id: session.user.org_id, date: { gte: from, lte: to } },
      select: { date: true, status: true, overtime_hours: true, is_late: true },
    })

    // Group by month (1-12)
    const months: Record<number, { present: number; absent: number; late: number; ot_hours: number }> = {}
    for (let m = 1; m <= 12; m++) months[m] = { present: 0, absent: 0, late: 0, ot_hours: 0 }

    for (const r of records) {
      const m = new Date(r.date).getUTCMonth() + 1
      if (r.status === 'present' || r.status === 'late') months[m].present++
      else if (r.status === 'absent') months[m].absent++
      if (r.is_late) months[m].late++
      if (r.overtime_hours) months[m].ot_hours += Number(r.overtime_hours)
    }

    const summary = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      ...months[i + 1],
    }))

    return NextResponse.json({ success: true, data: { year, summary } })
  } catch (error) {
    console.error('Year summary error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch year summary' }, { status: 500 })
  }
}
