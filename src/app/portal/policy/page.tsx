'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Clock, ChevronLeft, Loader2 } from 'lucide-react'

export default function PolicyPage() {
  const router = useRouter()
  const [leavePolicyText, setLeavePolicyText] = useState('')
  const [attendancePolicyText, setAttendancePolicyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'leave' | 'attendance'>('leave')

  useEffect(() => {
    fetch('/api/org/settings')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const s = json.data as Record<string, unknown>
          if (s.leave_policy_text) setLeavePolicyText(s.leave_policy_text as string)
          if (s.attendance_policy_text) setAttendancePolicyText(s.attendance_policy_text as string)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-sm font-semibold leading-none">Company Policies</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Leave & attendance rules</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Tab switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('leave')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              activeTab === 'leave'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/40'
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> Leave Policy
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              activeTab === 'attendance'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/40'
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Attendance Policy
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === 'leave' ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Leave Policy
                <Badge variant="secondary" className="text-[10px] ml-1">Read-only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leavePolicyText ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                  {leavePolicyText}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-8">
                  No leave policy has been published yet. Contact HR for details.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-600" />
                Attendance Policy
                <Badge variant="secondary" className="text-[10px] ml-1">Read-only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendancePolicyText ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                  {attendancePolicyText}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-8">
                  No attendance policy has been published yet. Contact HR for details.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
