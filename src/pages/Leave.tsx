'use client'

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText, CalendarDays, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface LeaveRequest {
  id: string;
  status: string;
  from_date: string;
  to_date: string;
  total_days: number;
  reason: string;
  created_at: string;
  rejection_reason: string | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    emp_code: string;
    department: { name: string } | null;
  };
  leave_type: {
    id: string;
    name: string;
    code: string;
  };
}

const typeColor: Record<string, string> = {
  CL: "bg-primary/80", SL: "bg-kpi-green",
  EL: "bg-kpi-amber", ML: "bg-kpi-purple", LOP: "bg-destructive/60",
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const Leave = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [holidayModal, setHolidayModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());

  async function fetchRequests() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter.toLowerCase());
      const res = await fetch(`/api/leave/requests?${params}&limit=50`);
      const json = await res.json();
      if (json.success) setRequests(json.data.requests);
      else toast.error('Failed to load leave requests');
    } catch {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRequests(); }, [statusFilter]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/leave/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Leave approved — employee notified');
        fetchRequests();
      } else toast.error('Failed to approve leave');
    } catch {
      toast.error('Failed to approve leave');
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmReject() {
    if (!rejectModal || !rejectReason.trim()) return;
    setActionLoading(rejectModal);
    try {
      const res = await fetch(`/api/leave/requests/${rejectModal}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejection_reason: rejectReason }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Leave rejected');
        fetchRequests();
      } else toast.error('Failed to reject leave');
    } catch {
      toast.error('Failed to reject leave');
    } finally {
      setActionLoading(null);
      setRejectModal(null);
      setRejectReason('');
    }
  }

  async function approveAll() {
    const pending = requests.filter(r => r.status === 'pending');
    for (const r of pending) await handleApprove(r.id);
    toast.success('All pending leaves approved');
  }

  const pending = requests.filter(r => r.status === 'pending');
  const approved = requests.filter(r => r.status === 'approved');
  const rejected = requests.filter(r => r.status === 'rejected');

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter.toLowerCase()) return false;
    if (typeFilter !== 'all' && r.leave_type.code !== typeFilter) return false;
    return true;
  });

  // Calendar
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();

  const calendarLeaves: Record<number, { type: string; name: string }[]> = {};
  requests.filter(r => r.status === 'approved').forEach(r => {
    const from = new Date(r.from_date);
    const to = new Date(r.to_date);
    const cur = new Date(from);
    while (cur <= to) {
      if (cur.getMonth() === calMonth && cur.getFullYear() === calYear) {
        const day = cur.getDate();
        if (!calendarLeaves[day]) calendarLeaves[day] = [];
        calendarLeaves[day].push({
          type: r.leave_type.code,
          name: `${r.employee.first_name} ${r.employee.last_name[0]}.`,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  });

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <AppLayout title="Leave Management">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1.5" /> Manage Leave Types</Button>
          <Button variant="outline" size="sm" onClick={() => setHolidayModal(true)}>
            <CalendarDays className="h-4 w-4 mr-1.5" /> Holiday Calendar
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Requests", value: String(requests.length), color: "text-foreground" },
          { label: "Pending Approval", value: String(pending.length), color: "text-kpi-amber", pulse: true },
          { label: "Approved", value: String(approved.length), color: "text-kpi-green" },
          { label: "Rejected", value: String(rejected.length), color: "text-destructive" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                {k.pulse && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kpi-amber opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-kpi-amber" />
                  </span>
                )}
                {k.label}
              </p>
              <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main panels */}
      <div className="grid lg:grid-cols-5 gap-6 mb-6">
        {/* Pending Approvals */}
        <Card className="lg:col-span-3 border-l-4 border-l-kpi-amber">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">
              Pending Approvals ({pending.length})
            </CardTitle>
            {pending.length > 0 && (
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={approveAll}>
                Approve All
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : pending.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No pending leave requests
              </div>
            ) : (
              pending.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3 bg-card hover:shadow-sm transition-shadow">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {r.employee.first_name[0]}{r.employee.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">
                        {r.employee.first_name} {r.employee.last_name}
                      </span>
                      <Badge className="text-[10px] px-1.5 py-0">{r.leave_type.code}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.from_date)} – {formatDate(r.to_date)} · {Number(r.total_days)}d
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{r.reason}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs bg-kpi-green hover:bg-kpi-green/90 text-white"
                      onClick={() => handleApprove(r.id)}
                      disabled={actionLoading === r.id}
                    >
                      {actionLoading === r.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve</>
                      }
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => { setRejectModal(r.id); setRejectReason(''); }}
                      disabled={actionLoading === r.id}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Leave Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Leave Calendar</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                else setCalMonth(m => m - 1);
              }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-24 text-center">
                {monthNames[calMonth]} {calYear}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                else setCalMonth(m => m + 1);
              }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-7 mb-1">
              {weekdays.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const leaves = calendarLeaves[day] || [];
                const isWeekend = new Date(calYear, calMonth, day).getDay() === 0 || new Date(calYear, calMonth, day).getDay() === 6;
                return (
                  <Tooltip key={day}>
                    <TooltipTrigger asChild>
                      <div className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs cursor-default transition-colors ${isWeekend ? "bg-muted/60 text-muted-foreground" : "hover:bg-secondary"}`}>
                        <span className={`font-medium leading-none ${leaves.length > 0 ? "mb-0.5" : ""}`}>{day}</span>
                        {leaves.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {leaves.slice(0, 2).map((l, li) => (
                              <span key={li} className={`h-1.5 w-1.5 rounded-full ${typeColor[l.type] || "bg-muted-foreground"}`} />
                            ))}
                            {leaves.length > 2 && <span className="text-[8px] text-muted-foreground leading-none">+{leaves.length - 2}</span>}
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    {leaves.length > 0 && (
                      <TooltipContent side="top" className="text-xs">
                        {leaves.map((l, li) => <div key={li}>{l.name} — {l.type}</div>)}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
              {[
                { label: "CL", cls: "bg-primary/80" },
                { label: "SL", cls: "bg-kpi-green" },
                { label: "EL", cls: "bg-kpi-amber" },
                { label: "ML", cls: "bg-kpi-purple" },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`h-2.5 w-2.5 rounded-full ${l.cls}`} />{l.label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold">All Leave Requests</CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CL">Casual</SelectItem>
                  <SelectItem value="SL">Sick</SelectItem>
                  <SelectItem value="EL">Earned</SelectItem>
                  <SelectItem value="ML">Maternity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No leave requests found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied On</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.employee.first_name} {r.employee.last_name}
                    </TableCell>
                    <TableCell>
                      <Badge className="text-[10px]">{r.leave_type.code}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(r.from_date)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(r.to_date)}</TableCell>
                    <TableCell className="text-center tabular-nums">{Number(r.total_days)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        r.status === 'approved' ? 'active' :
                        r.status === 'rejected' ? 'terminated' : 'notice'
                      }>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(r.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {r.status === 'pending' ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[10px] bg-kpi-green hover:bg-kpi-green/90 text-white"
                            onClick={() => handleApprove(r.id)}
                            disabled={actionLoading === r.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] text-destructive border-destructive/30"
                            onClick={() => { setRejectModal(r.id); setRejectReason(''); }}
                            disabled={actionLoading === r.id}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog open={rejectModal !== null} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>Please provide a reason for rejection</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection Reason <span className="text-destructive">*</span></Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
            />
            {rejectReason.length === 0 && (
              <p className="text-xs text-destructive">Reason is required</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectReason.trim()}>
              Reject Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Holiday Calendar Modal */}
      <Dialog open={holidayModal} onOpenChange={setHolidayModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Holiday Calendar 2026</DialogTitle>
            <DialogDescription>Company holidays for the current year</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Holiday</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { date: "26 Jan", name: "Republic Day", type: "National" },
                { date: "14 Apr", name: "Dr. Ambedkar Jayanti", type: "National" },
                { date: "01 May", name: "May Day", type: "National" },
                { date: "15 Aug", name: "Independence Day", type: "National" },
                { date: "02 Oct", name: "Gandhi Jayanti", type: "National" },
                { date: "25 Dec", name: "Christmas", type: "Optional" },
              ].map((h) => (
                <TableRow key={h.date}>
                  <TableCell className="font-medium">{h.date}</TableCell>
                  <TableCell>{h.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{h.type}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Leave;