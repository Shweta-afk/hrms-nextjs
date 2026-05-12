'use client'

import { useState, useEffect } from "react";
import { Video, Wallet, CalendarDays, Loader2, AlertTriangle } from "lucide-react";

interface UpcomingData {
  interviews_today: number
  pending_payroll: boolean
  pending_leaves: number
  upcoming_holidays: { name: string; date: string }[]
}

const UpcomingPanel = () => {
  const [data, setData] = useState<UpcomingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch_data() {
      try {
        const [recruitRes, payrollRes, leaveRes, holidayRes] = await Promise.all([
          fetch('/api/recruitment/candidates'),
          fetch('/api/payroll/runs'),
          fetch('/api/leave/requests?status=pending&limit=50'),
          fetch('/api/holidays'),
        ])

        const [recruitJson, payrollJson, leaveJson, holidayJson] = await Promise.all([
          recruitRes.json(), payrollRes.json(), leaveRes.json(), holidayRes.json(),
        ])

        const today = new Date().toDateString()

        // Count interviews today (candidates in interview stage created today)
        const interviewsToday = recruitJson.success
          ? recruitJson.data.filter((c: any) =>
              c.stage === 'interview' &&
              new Date(c.created_at).toDateString() === today
            ).length
          : 0

        // Check if any payroll run is in processing/draft state
        const pendingPayroll = payrollJson.success
          ? payrollJson.data.some((r: any) => ['draft', 'processing'].includes(r.status))
          : false

        // Count pending leave requests
        const pendingLeaves = leaveJson.success ? leaveJson.data.total : 0

        // Get upcoming holidays
        const upcomingHolidays = holidayJson.success
          ? holidayJson.data.slice(0, 2)
          : []

        setData({
          interviews_today: interviewsToday,
          pending_payroll: pendingPayroll,
          pending_leaves: pendingLeaves,
          upcoming_holidays: upcomingHolidays,
        })
      } catch (err) {
        console.error('Failed to fetch upcoming data', err)
      } finally {
        setLoading(false)
      }
    }
    fetch_data()
  }, [])

  const items = data ? [
    data.interviews_today > 0 && {
      icon: Video,
      text: `${data.interviews_today} interview(s) in pipeline today`,
      detail: 'Candidates in interview stage',
      color: 'text-primary',
    },
    data.pending_payroll && {
      icon: Wallet,
      text: 'Payroll pending approval',
      detail: 'Review and approve this month\'s payroll',
      color: 'text-chart-2',
    },
    data.pending_leaves > 0 && {
      icon: AlertTriangle,
      text: `${data.pending_leaves} leave request(s) pending`,
      detail: 'Requires your approval',
      color: 'text-kpi-amber',
    },
    ...data.upcoming_holidays.map(h => ({
      icon: CalendarDays,
      text: h.name,
      detail: new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
      color: 'text-kpi-green',
    })),
  ].filter(Boolean) : []

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming</h3>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nothing upcoming — all clear!</p>
      ) : (
        <div className="space-y-4">
          {(items as any[]).map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.text}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default UpcomingPanel