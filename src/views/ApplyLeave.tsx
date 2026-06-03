'use client'

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, eachDayOfInterval, isWeekend } from "date-fns";
import { CalendarIcon, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LeaveType {
  id: string; name: string; code: string
  days_per_year: number; is_paid: boolean
}
interface LeaveBalance {
  leave_type_id: string; name: string; code: string
  total: number; taken: number; available: number
}

const balanceColorMap: Record<string, string> = {
  CL: "bg-primary", SL: "bg-kpi-green", EL: "bg-kpi-amber",
  PL: "bg-kpi-amber", ML: "bg-kpi-purple", LOP: "bg-destructive",
}

const statusVariant = (s: string) => {
  if (s === "approved") return "active" as const
  if (s === "pending") return "notice" as const
  return "terminated" as const
}

const ApplyLeave = () => {
  const router = useRouter()
  const { data: session } = useSession()

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [recentHistory, setRecentHistory] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [leaveTypeId, setLeaveTypeId] = useState("")
  const [fromDate, setFromDate] = useState<Date>()
  const [toDate, setToDate] = useState<Date>()
  const [halfDay, setHalfDay] = useState(false)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      setLoadingData(true)
      try {
        const [typesRes, balRes, histRes] = await Promise.all([
          fetch('/api/leave/types'),
          fetch('/api/leave/balance'),
          fetch('/api/leave/requests?limit=5'),
        ])
        const [typesJson, balJson, histJson] = await Promise.all([
          typesRes.json(), balRes.json(), histRes.json(),
        ])
        if (typesJson.success) setLeaveTypes(typesJson.data)
        if (balJson.success) setBalances(balJson.data)
        if (histJson.success) setRecentHistory(histJson.data.requests || [])
      } catch {
        toast.error('Failed to load leave data')
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [])

  const workingDays = useMemo(() => {
    if (!fromDate || !toDate || toDate < fromDate) return 0
    const days = eachDayOfInterval({ start: fromDate, end: toDate })
    let count = days.filter(d => !isWeekend(d)).length
    if (halfDay && count > 0) count = count - 0.5
    return count
  }, [fromDate, toDate, halfDay])

  const selectedBalance = balances.find(b => b.leave_type_id === leaveTypeId)
  const selectedType = leaveTypes.find(t => t.id === leaveTypeId)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!leaveTypeId) errs.leaveType = "Leave type is required"
    if (!fromDate) errs.fromDate = "From date is required"
    if (!toDate) errs.toDate = "To date is required"
    if (fromDate && toDate && toDate < fromDate) errs.toDate = "To date must be after from date"
    if (!reason.trim()) errs.reason = "Reason is required"
    if (selectedBalance && workingDays > selectedBalance.available)
      errs.days = `Only ${selectedBalance.available} day(s) available`
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/leave/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type_id: leaveTypeId,
          from_date: fromDate!.toISOString(),
          to_date: toDate!.toISOString(),
          reason: reason.trim(),
          employee_id: session?.user?.employee_id,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSubmitted(true)
        toast.success('Leave request submitted successfully')
      } else {
        toast.error(json.error || 'Failed to submit leave request')
      }
    } catch {
      toast.error('Failed to submit leave request')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="p-8 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-kpi-green/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-kpi-green" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Leave Request Submitted</h2>
          <p className="text-sm text-muted-foreground">
            Your {selectedType?.name} request for {workingDays} day(s) has been submitted for approval.
          </p>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={() => router.push('/portal')}>
              Back to Portal
            </Button>
            <Button className="flex-1" onClick={() => {
              setLeaveTypeId(""); setFromDate(undefined); setToDate(undefined)
              setHalfDay(false); setReason(""); setSubmitted(false); setErrors({})
            }}>
              Apply Another
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 pt-4">
        {loadingData ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left — Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Leave Balances */}
              {balances.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {balances.map(b => (
                    <Card key={b.leave_type_id}
                      className={cn("border-2 transition-colors cursor-pointer", leaveTypeId === b.leave_type_id ? "border-primary" : "border-transparent")}
                      onClick={() => setLeaveTypeId(b.leave_type_id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("h-2.5 w-2.5 rounded-full", balanceColorMap[b.code] || "bg-muted")} />
                          <span className="text-xs font-semibold text-muted-foreground">{b.code}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{b.name}</p>
                        <Progress value={b.total > 0 ? (b.taken / b.total) * 100 : 0} className="h-1.5 mb-1" />
                        <p className="text-xs text-foreground font-medium">{b.available} of {b.total} days left</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Form */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Leave Request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-1.5">
                    <Label>Leave Type *</Label>
                    <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                      <SelectTrigger className={errors.leaveType ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select leave type" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name} ({t.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.leaveType && <p className="text-xs text-destructive">{errors.leaveType}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>From Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fromDate && "text-muted-foreground", errors.fromDate && "border-destructive")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {fromDate ? format(fromDate, "d MMM yyyy") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={setFromDate} /></PopoverContent>
                      </Popover>
                      {errors.fromDate && <p className="text-xs text-destructive">{errors.fromDate}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>To Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !toDate && "text-muted-foreground", errors.toDate && "border-destructive")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {toDate ? format(toDate, "d MMM yyyy") : "Pick date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={setToDate} /></PopoverContent>
                      </Popover>
                      {errors.toDate && <p className="text-xs text-destructive">{errors.toDate}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="half" checked={halfDay} onCheckedChange={v => setHalfDay(!!v)} />
                    <Label htmlFor="half" className="cursor-pointer text-sm font-normal">Half day</Label>
                  </div>

                  {workingDays > 0 && (
                    <div className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium",
                      errors.days ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"
                    )}>
                      {workingDays} working day{workingDays !== 1 ? 's' : ''} selected
                      {selectedBalance && ` · ${selectedBalance.available} available`}
                      {errors.days && ` — ${errors.days}`}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Reason *</Label>
                    <Textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Briefly explain your reason for leave..."
                      rows={3}
                      className={errors.reason ? "border-destructive" : ""}
                    />
                    {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => router.push('/portal')}>Cancel</Button>
                    <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                      {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : 'Submit Request'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right — Recent History */}
            <div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Recent Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No requests yet.</p>
                  ) : recentHistory.map((r: any) => (
                    <div key={r.id} className="border border-border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{r.leave_type?.name || 'Leave'}</span>
                        <Badge variant={statusVariant(r.status)} className="text-[10px]">{r.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.from_date), 'd MMM')} – {format(new Date(r.to_date), 'd MMM yyyy')} · {Number(r.total_days)} day{Number(r.total_days) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
    </div>
  )
}

export default ApplyLeave
