'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Receipt, CheckCircle2, XCircle, Clock, IndianRupee } from 'lucide-react'
import { toast } from 'sonner'

interface Reimbursement {
  id: string
  employee_id: string
  title: string
  description: string | null
  amount: number
  bill_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at: string
  employee: {
    id: string
    first_name: string
    last_name: string
    emp_code: string
    department: { name: string } | null
  }
}

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'approved') return (
    <Badge className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
      Approved
    </Badge>
  )
  if (status === 'rejected') return (
    <Badge className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800">
      Rejected
    </Badge>
  )
  return (
    <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800">
      Pending
    </Badge>
  )
}

const Reimbursements = () => {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReasonInput, setRejectionReasonInput] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function fetchReimbursements(status?: string) {
    setLoading(true)
    try {
      const url = status && status !== 'all'
        ? `/api/reimbursements?status=${status}`
        : '/api/reimbursements'
      const res = await fetch(url)
      const json = await res.json()
      if (json.success) setReimbursements(json.data)
      else toast.error(json.error ?? 'Failed to load reimbursements')
    } catch {
      toast.error('Failed to load reimbursements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReimbursements(activeTab === 'all' ? undefined : activeTab)
  }, [activeTab])

  async function handleApprove(id: string) {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/reimbursements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Reimbursement approved')
        fetchReimbursements(activeTab === 'all' ? undefined : activeTab)
      } else {
        toast.error(json.error ?? 'Failed to approve')
      }
    } catch {
      toast.error('Failed to approve reimbursement')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(id: string) {
    if (!rejectionReasonInput.trim()) {
      toast.error('Please enter a rejection reason')
      return
    }
    setActionLoading(id)
    try {
      const res = await fetch(`/api/reimbursements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejection_reason: rejectionReasonInput.trim() }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Reimbursement rejected')
        setRejectingId(null)
        setRejectionReasonInput('')
        fetchReimbursements(activeTab === 'all' ? undefined : activeTab)
      } else {
        toast.error(json.error ?? 'Failed to reject')
      }
    } catch {
      toast.error('Failed to reject reimbursement')
    } finally {
      setActionLoading(null)
    }
  }

  // Summary calculations across all loaded reimbursements
  const allRes = reimbursements
  const pending = allRes.filter(r => r.status === 'pending')
  const approved = allRes.filter(r => r.status === 'approved')
  const rejected = allRes.filter(r => r.status === 'rejected')
  const totalApprovedAmount = approved.reduce((s, r) => s + Number(r.amount), 0)

  const ReimbursementTable = ({ items }: { items: Reimbursement[] }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Bill</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                No reimbursements found
              </TableCell>
            </TableRow>
          ) : (
            items.map(r => (
              <>
                <TableRow key={r.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">
                        {r.employee.first_name} {r.employee.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.employee.emp_code}{r.employee.department ? ` · ${r.employee.department.name}` : ''}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>
                    )}
                    {r.rejection_reason && r.status === 'rejected' && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                        Reason: {r.rejection_reason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {fmt(Number(r.amount))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    {r.bill_url ? (
                      <a
                        href={r.bill_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <div className="flex items-center gap-1.5 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => handleApprove(r.id)}
                          disabled={actionLoading === r.id}
                        >
                          {actionLoading === r.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <><CheckCircle2 className="h-3 w-3 mr-1" />Approve</>
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            setRejectingId(rejectingId === r.id ? null : r.id)
                            setRejectionReasonInput('')
                          }}
                          disabled={actionLoading === r.id}
                        >
                          <XCircle className="h-3 w-3 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                    {r.status !== 'pending' && (
                      <span className="text-xs text-muted-foreground text-center block">
                        {r.status === 'approved' && r.approved_at
                          ? new Date(r.approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          : '—'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>

                {/* Inline rejection reason input */}
                {rejectingId === r.id && (
                  <TableRow key={`${r.id}-reject`} className="bg-red-50/50 dark:bg-red-900/10">
                    <TableCell colSpan={7} className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Input
                          className="flex-1 h-8 text-sm"
                          placeholder="Enter rejection reason..."
                          value={rejectionReasonInput}
                          onChange={e => setRejectionReasonInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleReject(r.id) }}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => handleReject(r.id)}
                          disabled={actionLoading === r.id || !rejectionReasonInput.trim()}
                        >
                          {actionLoading === r.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : 'Confirm Reject'
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => { setRejectingId(null); setRejectionReasonInput('') }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          Reimbursements
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-200/60 dark:border-amber-800/40">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Pending</p>
              <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                {pending.length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200/60 dark:border-green-800/40">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
              <IndianRupee className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Approved Amount</p>
              <p className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">
                {fmt(totalApprovedAmount)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200/60 dark:border-red-800/40">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Rejected</p>
              <p className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
                {rejected.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader className="pb-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">
                Pending
                {pending.length > 0 && (
                  <span className="ml-1.5 h-4 w-4 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center">
                    {pending.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ReimbursementTable items={reimbursements} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Reimbursements
