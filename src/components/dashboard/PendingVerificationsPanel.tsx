'use client'

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { FileCheck2, Loader2, ChevronRight, ShieldAlert } from "lucide-react"

interface PendingItem {
  employee_id: string
  emp_code: string
  name: string
  department: string | null
  pending_count: number
  oldest_uploaded_at: string | null
}

interface Payload {
  items: PendingItem[]
  total_employees: number
  total_pending_docs: number
  truncated: boolean
}

// Same "x ago" formatter as RecentActivity, lifted so the cadence matches.
// Kept in-file rather than extracted to a util because it's 8 lines and
// nothing else on the dashboard format-shares with it yet.
function timeAgo(iso: string | null) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days >= 1) return `${days}d ago`
  const hrs = Math.floor(diffMs / 3_600_000)
  if (hrs >= 1) return `${hrs}h ago`
  const mins = Math.floor(diffMs / 60_000)
  return mins < 1 ? 'just now' : `${mins}m ago`
}

// Highlight rows that have been sitting > 7 days — HR's verification SLA.
// Tweak the threshold here if/when there's an explicit policy.
const SLA_DAYS = 7
function isOverdue(iso: string | null) {
  if (!iso) return false
  return (Date.now() - new Date(iso).getTime()) / 86_400_000 > SLA_DAYS
}

const PendingVerificationsPanel = () => {
  // Cached via TanStack so flipping Dashboard → Employees → Dashboard
  // doesn't re-hit the aggregate. Refetches on window focus to catch
  // verifications HR did in another tab.
  const { data, isLoading } = useQuery<Payload>({
    queryKey: ['dashboard-pending-verifications'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/pending-verifications')
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'fetch failed')
      return json.data
    },
  })

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" />
            Pending Document Verification
          </h3>
          {data && data.total_pending_docs > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {data.total_pending_docs} document{data.total_pending_docs === 1 ? '' : 's'} from{' '}
              {data.total_employees} employee{data.total_employees === 1 ? '' : 's'} awaiting review
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileCheck2 className="h-8 w-8 text-kpi-green mb-2" />
          <p className="text-sm font-medium text-foreground">All caught up</p>
          <p className="text-xs text-muted-foreground mt-1">
            No documents are waiting for verification.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {data.items.map(item => {
              const overdue = isOverdue(item.oldest_uploaded_at)
              return (
                <li key={item.employee_id}>
                  <Link
                    href={`/employees/${item.employee_id}?tab=documents`}
                    className={`group flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-secondary/60 ${
                      overdue
                        ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-900/10'
                        : 'border-border'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item.emp_code}
                        </span>
                        {overdue && (
                          <span
                            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"
                            title={`Uploaded more than ${SLA_DAYS} days ago`}
                          >
                            <ShieldAlert className="h-3 w-3" />
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {item.pending_count} pending
                        {item.department ? ` · ${item.department}` : ''}
                        {item.oldest_uploaded_at ? ` · oldest ${timeAgo(item.oldest_uploaded_at)}` : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                  </Link>
                </li>
              )
            })}
          </ul>
          {data.truncated && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Showing {data.items.length} of {data.total_employees} employees with pending docs
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default PendingVerificationsPanel
