'use client'

import { useQuery } from "@tanstack/react-query"
import { Cake, Gift, Loader2 } from "lucide-react"

interface Birthday {
  employee_id: string
  emp_code:    string
  name:        string
  department:  string | null
  date_label:  string
  days_away:   number
  is_today:    boolean
}

interface Payload {
  items:       Birthday[]
  window_days: number
}

// Compact "in X" phrasing — matches the cadence of the other dashboard
// panels (RecentActivity uses "X min ago", UpcomingPanel uses calendar dates).
function inDays(d: number) {
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return `in ${d} days`
}

const BirthdaysPanel = () => {
  const { data, isLoading } = useQuery<Payload>({
    queryKey: ['dashboard-upcoming-birthdays'],
    queryFn: async () => {
      const res = await fetch('/api/birthdays/upcoming?days=14')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'fetch failed')
      return json.data
    },
    // Birthdays are stable within a day — no point thrashing the cache.
    // 15 min is short enough that newly-onboarded employees show up the
    // same afternoon, long enough to amortize across panel re-mounts.
    staleTime: 15 * 60_000,
  })

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Cake className="h-4 w-4 text-primary" />
          Upcoming Birthdays
        </h3>
        {data && data.items.length > 0 && (
          <span className="text-xs text-muted-foreground">next {data.window_days} days</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Cake className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No birthdays in the next 14 days.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.items.map(b => (
            <li
              key={b.employee_id}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 ${
                b.is_today
                  ? 'border-pink-200 dark:border-pink-900/60 bg-pink-50/50 dark:bg-pink-900/10'
                  : 'border-border'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{b.emp_code}</span>
                  {b.is_today && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-pink-700 dark:text-pink-400">
                      <Gift className="h-3 w-3" />
                      Today
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {b.date_label}
                  {b.department ? ` · ${b.department}` : ''}
                </p>
              </div>
              <span
                className={`text-xs font-medium shrink-0 ${
                  b.is_today ? 'text-pink-700 dark:text-pink-400' : 'text-muted-foreground'
                }`}
              >
                {inDays(b.days_away)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BirthdaysPanel
