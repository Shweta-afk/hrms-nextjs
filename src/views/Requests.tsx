'use client'

import { useState, useEffect } from 'react'
import AppLayout from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Inbox, MessageSquareReply, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface HRRequest {
  id: string
  type: string
  subject: string
  description: string
  status: string
  reply: string | null
  replied_at: string | null
  created_at: string
  employee: {
    id: string
    first_name: string
    last_name: string
    emp_code: string
    department: { name: string } | null
  }
}

const TYPE_LABELS: Record<string, string> = {
  salary:     'Salary',
  document:   'Document',
  attendance: 'Attendance',
  general:    'General',
  other:      'Other',
}

const STATUS_COLOR: Record<string, string> = {
  open:        'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved:    'bg-green-100 text-green-700',
  closed:      'bg-slate-100 text-slate-600',
}

const STATUS_LABELS: Record<string, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  closed:      'Closed',
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const Requests = () => {
  const [requests, setRequests]   = useState<HRRequest[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [selected, setSelected]   = useState<HRRequest | null>(null)
  const [reply, setReply]         = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving]       = useState(false)

  async function fetchRequests() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('limit', '100')
      const res  = await fetch(`/api/requests?${params}`)
      const json = await res.json()
      if (json.success) setRequests(json.data.requests)
      else toast.error('Failed to load requests')
    } catch {
      toast.error('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [statusFilter])

  function openRequest(r: HRRequest) {
    setSelected(r)
    setReply(r.reply ?? '')
    setNewStatus(r.status)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      const res  = await fetch(`/api/requests/${selected.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          status: newStatus !== selected.status ? newStatus : undefined,
          reply:  reply.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Response saved — employee notified')
        setSelected(null)
        fetchRequests()
      } else toast.error(json.error ?? 'Failed to save')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const filtered = requests.filter(r =>
    (typeFilter === 'all' || r.type === typeFilter)
  )

  const counts = {
    open:        requests.filter(r => r.status === 'open').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    resolved:    requests.filter(r => r.status === 'resolved').length,
  }

  return (
    <AppLayout title="Employee Requests">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-blue-200">
          <CardContent className="py-4 flex items-center gap-3">
            <Inbox className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{counts.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="py-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{counts.in_progress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{counts.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" /> Requests Inbox
            </CardTitle>
            <div className="flex gap-2 sm:ml-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Inbox className="h-10 w-10" />
              <p className="text-sm">No requests found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openRequest(r)}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {r.employee.first_name} {r.employee.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.employee.emp_code} · {r.employee.department?.name ?? '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium">{TYPE_LABELS[r.type] ?? r.type}</span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-1">{r.subject}</p>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[r.status] ?? ''}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                        onClick={e => { e.stopPropagation(); openRequest(r) }}>
                        <MessageSquareReply className="h-3.5 w-3.5" />
                        Reply
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reply dialog */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Employee Request</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {selected.employee.first_name} {selected.employee.last_name}
                    <span className="text-muted-foreground font-normal ml-1">
                      ({selected.employee.emp_code})
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">{fmt(selected.created_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {TYPE_LABELS[selected.type] ?? selected.type}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>
                <p className="font-semibold">{selected.subject}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{selected.description}</p>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Reply to employee</Label>
                <Textarea
                  rows={4}
                  placeholder="Type your response here…"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                />
              </div>

              {selected.replied_at && (
                <p className="text-xs text-muted-foreground">
                  Last reply sent {fmt(selected.replied_at)}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save &amp; Notify Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default Requests
