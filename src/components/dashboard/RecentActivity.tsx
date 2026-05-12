'use client'

import { useState, useEffect } from "react";
import { Bell, CheckCircle, UserPlus, FileText, Loader2 } from "lucide-react";

interface Notification {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const typeIcon: Record<string, any> = {
  success: CheckCircle,
  info: Bell,
  warning: FileText,
  error: FileText,
}

const typeColor: Record<string, string> = {
  success: 'text-kpi-green',
  info: 'text-primary',
  warning: 'text-kpi-amber',
  error: 'text-destructive',
}

const RecentActivity = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(json => {
        if (json.success) setNotifications(json.data.notifications.slice(0, 5))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h3>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
      ) : (
        <div className="space-y-4">
          {notifications.map(n => {
            const Icon = typeIcon[n.type] ?? Bell
            const color = typeColor[n.type] ?? 'text-muted-foreground'
            return (
              <div key={n.id} className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default RecentActivity