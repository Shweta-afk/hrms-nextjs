import { useState } from "react";
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
  FileText, CalendarDays, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

/* ── data ─────────────────────────────────────────── */

interface PendingRequest {
  id: number; name: string; initials: string; type: string; from: string; to: string; days: number; reason: string; status: "pending" | "approved" | "rejected";
}

const initialPending: PendingRequest[] = [
  { id: 1, name: "Arun Mehta", initials: "AM", type: "CL", from: "24 Mar", to: "25 Mar", days: 2, reason: "Family function in Jaipur — need to travel a day early for preparations", status: "pending" },
  { id: 2, name: "Sneha Iyer", initials: "SI", type: "SL", from: "21 Mar", to: "23 Mar", days: 3, reason: "Down with viral fever, doctor advised rest for a few days", status: "pending" },
  { id: 3, name: "Farhan Qureshi", initials: "FQ", type: "PL", from: "28 Mar", to: "04 Apr", days: 6, reason: "Planned family vacation to Goa — tickets already booked", status: "pending" },
  { id: 4, name: "Deepa Nair", initials: "DN", type: "CL", from: "26 Mar", to: "26 Mar", days: 1, reason: "Parent-teacher meeting at daughter's school in the morning", status: "pending" },
  { id: 5, name: "Vikram Singh", initials: "VS", type: "ML", from: "20 Mar", to: "17 Jun", days: 90, reason: "Maternity leave as per company policy — due date in late March", status: "pending" },
];

interface AllRequest {
  id: number; name: string; type: string; from: string; to: string; days: number; status: string; appliedOn: string;
}

const initialAll: AllRequest[] = [
  { id: 1, name: "Priya Sharma", type: "CL", from: "03 Mar 2026", to: "04 Mar 2026", days: 2, status: "Approved", appliedOn: "28 Feb 2026" },
  { id: 2, name: "Karan Patel", type: "SL", from: "06 Mar 2026", to: "07 Mar 2026", days: 2, status: "Approved", appliedOn: "05 Mar 2026" },
  { id: 3, name: "Arun Mehta", type: "CL", from: "24 Mar 2026", to: "25 Mar 2026", days: 2, status: "Pending", appliedOn: "18 Mar 2026" },
  { id: 4, name: "Sneha Iyer", type: "SL", from: "21 Mar 2026", to: "23 Mar 2026", days: 3, status: "Pending", appliedOn: "19 Mar 2026" },
  { id: 5, name: "Meera Reddy", type: "PL", from: "10 Mar 2026", to: "14 Mar 2026", days: 5, status: "Approved", appliedOn: "01 Mar 2026" },
  { id: 6, name: "Rahul Gupta", type: "CL", from: "12 Mar 2026", to: "12 Mar 2026", days: 1, status: "Rejected", appliedOn: "10 Mar 2026" },
  { id: 7, name: "Farhan Qureshi", type: "PL", from: "28 Mar 2026", to: "04 Apr 2026", days: 6, status: "Pending", appliedOn: "20 Mar 2026" },
  { id: 8, name: "Anita Desai", type: "SL", from: "15 Mar 2026", to: "16 Mar 2026", days: 2, status: "Approved", appliedOn: "13 Mar 2026" },
  { id: 9, name: "Deepa Nair", type: "CL", from: "26 Mar 2026", to: "26 Mar 2026", days: 1, status: "Pending", appliedOn: "20 Mar 2026" },
  { id: 10, name: "Suresh Babu", type: "PL", from: "01 Apr 2026", to: "03 Apr 2026", days: 3, status: "Approved", appliedOn: "15 Mar 2026" },
];

const calendarLeaves: Record<number, { type: string; name: string }[]> = {
  3: [{ type: "CL", name: "Priya S." }], 4: [{ type: "CL", name: "Priya S." }],
  6: [{ type: "SL", name: "Karan P." }], 7: [{ type: "SL", name: "Karan P." }],
  10: [{ type: "PL", name: "Meera R." }, { type: "CL", name: "Rahul G." }],
  11: [{ type: "PL", name: "Meera R." }], 12: [{ type: "PL", name: "Meera R." }, { type: "CL", name: "Rahul G." }],
  13: [{ type: "PL", name: "Meera R." }], 14: [{ type: "PL", name: "Meera R." }],
  15: [{ type: "SL", name: "Anita D." }], 16: [{ type: "SL", name: "Anita D." }],
  21: [{ type: "SL", name: "Sneha I." }], 22: [{ type: "SL", name: "Sneha I." }, { type: "ML", name: "Vikram S." }],
  23: [{ type: "SL", name: "Sneha I." }, { type: "ML", name: "Vikram S." }, { type: "CL", name: "Deepa N." }],
  24: [{ type: "CL", name: "Arun M." }, { type: "ML", name: "Vikram S." }],
  25: [{ type: "CL", name: "Arun M." }, { type: "ML", name: "Vikram S." }],
  26: [{ type: "CL", name: "Deepa N." }, { type: "ML", name: "Vikram S." }],
  28: [{ type: "PL", name: "Farhan Q." }], 29: [{ type: "PL", name: "Farhan Q." }],
  30: [{ type: "PL", name: "Farhan Q." }], 31: [{ type: "PL", name: "Farhan Q." }],
};

/* ── helpers ──────────────────────────────────────── */

const typeColor: Record<string, string> = { CL: "bg-primary/80", SL: "bg-kpi-green", PL: "bg-kpi-amber", ML: "bg-kpi-purple" };
const typeBadgeVariant = (t: string) => { if (t === "CL") return "leave"; if (t === "SL") return "active"; if (t === "PL") return "notice"; return "secondary"; };
const statusBadgeVariant = (s: string) => { if (s === "Approved") return "active" as const; if (s === "Pending") return "notice" as const; if (s === "Rejected") return "terminated" as const; return "secondary" as const; };
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ── component ───────────────────────────────────── */

const Leave = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pending, setPending] = useState(initialPending);
  const [allReqs, setAllReqs] = useState(initialAll);
  const [rejectModal, setRejectModal] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [holidayModal, setHolidayModal] = useState(false);

  const year = 2026; const month = 2;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const filteredRequests = allReqs.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    return true;
  });

  const handleApprove = (id: number, fromPending = false) => {
    if (fromPending) {
      setPending((p) => p.map((r) => r.id === id ? { ...r, status: "approved" as const } : r));
    }
    setAllReqs((prev) => prev.map((r) => r.id === id ? { ...r, status: "Approved" } : r));
    toast.success("Leave approved — employee notified");
  };

  const openReject = (id: number) => { setRejectModal(id); setRejectReason(""); };

  const confirmReject = () => {
    if (!rejectReason.trim()) return;
    if (rejectModal) {
      setPending((p) => p.map((r) => r.id === rejectModal ? { ...r, status: "rejected" as const } : r));
      setAllReqs((prev) => prev.map((r) => r.id === rejectModal ? { ...r, status: "Rejected" } : r));
    }
    toast.success("Leave rejected");
    setRejectModal(null);
  };

  const approveAll = () => {
    setPending((p) => p.map((r) => r.status === "pending" ? { ...r, status: "approved" as const } : r));
    const pendingIds = new Set(pending.filter((r) => r.status === "pending").map((r) => r.id));
    setAllReqs((prev) => prev.map((r) => pendingIds.has(r.id) && r.status === "Pending" ? { ...r, status: "Approved" } : r));
    toast.success("All pending leaves approved");
  };

  return (
    <AppLayout title="Leave Management">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Management</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1.5" /> Manage Leave Types</Button>
          <Button variant="outline" size="sm" onClick={() => setHolidayModal(true)}><CalendarDays className="h-4 w-4 mr-1.5" /> Holiday Calendar</Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Requests This Month", value: "47", color: "text-foreground" },
          { label: "Pending Approval", value: String(pending.filter((r) => r.status === "pending").length), color: "text-kpi-amber", pulse: true },
          { label: "Approved", value: String(allReqs.filter((r) => r.status === "Approved").length), color: "text-kpi-green" },
          { label: "Rejected", value: String(allReqs.filter((r) => r.status === "Rejected").length), color: "text-destructive" },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                {k.pulse && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kpi-amber opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-kpi-amber" /></span>}
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
            <CardTitle className="text-base font-semibold">Pending Approvals</CardTitle>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={approveAll}>Approve All</Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {pending.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border p-3 bg-card hover:shadow-sm transition-shadow">
                <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{r.initials}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{r.name}</span>
                    <Badge variant={typeBadgeVariant(r.type) as any} className="text-[10px] px-1.5 py-0">{r.type}</Badge>
                    {r.status !== "pending" && <Badge variant={r.status === "approved" ? "active" : "terminated"} className="text-[10px]">{r.status === "approved" ? "Approved" : "Rejected"}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{r.from} – {r.to} · {r.days}d</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.reason}</p>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" className="h-7 px-2.5 text-xs bg-kpi-green hover:bg-kpi-green/90 text-white" onClick={() => handleApprove(r.id, true)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => openReject(r.id)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Leave Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Leave Calendar</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium w-24 text-center">Mar 2026</span>
              <Button variant="ghost" size="icon" className="h-7 w-7"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-7 mb-1">
              {weekdays.map((d) => (<div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: firstDay }).map((_, i) => (<div key={`e-${i}`} className="aspect-square" />))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const leaves = calendarLeaves[day] || [];
                const isWeekend = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6;
                return (
                  <Tooltip key={day}>
                    <TooltipTrigger asChild>
                      <div className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs cursor-default transition-colors ${isWeekend ? "bg-muted/60 text-muted-foreground" : "hover:bg-secondary"}`}>
                        <span className={`font-medium leading-none ${leaves.length > 0 ? "mb-0.5" : ""}`}>{day}</span>
                        {leaves.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {leaves.slice(0, 2).map((l, li) => (<span key={li} className={`h-1.5 w-1.5 rounded-full ${typeColor[l.type] || "bg-muted-foreground"}`} />))}
                            {leaves.length > 2 && (<span className="text-[8px] text-muted-foreground leading-none">+{leaves.length - 2}</span>)}
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    {leaves.length > 0 && (<TooltipContent side="top" className="text-xs">{leaves.map((l, li) => (<div key={li}>{l.name} — {l.type}</div>))}</TooltipContent>)}
                  </Tooltip>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
              {[{ label: "CL", cls: "bg-primary/80" }, { label: "SL", cls: "bg-kpi-green" }, { label: "PL", cls: "bg-kpi-amber" }, { label: "ML", cls: "bg-kpi-purple" }].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${l.cls}`} />{l.label}</div>
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
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CL">Casual</SelectItem>
                  <SelectItem value="SL">Sick</SelectItem>
                  <SelectItem value="PL">Privilege</SelectItem>
                  <SelectItem value="ML">Maternity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
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
              {filteredRequests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant={typeBadgeVariant(r.type) as any} className="text-[10px]">{r.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.from}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.to}</TableCell>
                  <TableCell className="text-center tabular-nums">{r.days}</TableCell>
                  <TableCell><Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.appliedOn}</TableCell>
                  <TableCell className="text-right">
                    {r.status === "Pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" className="h-6 px-2 text-[10px] bg-kpi-green hover:bg-kpi-green/90 text-white" onClick={() => handleApprove(r.id)}>Approve</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-destructive border-destructive/30" onClick={() => openReject(r.id)}>Reject</Button>
                      </div>
                    ) : (<span className="text-xs text-muted-foreground">—</span>)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog open={rejectModal !== null} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Reject Leave Request</DialogTitle><DialogDescription>Please provide a reason for rejection</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Label>Rejection Reason <span className="text-destructive">*</span></Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter reason..." rows={3} />
            {rejectReason.length === 0 && <p className="text-xs text-destructive">Reason is required</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectReason.trim()}>Reject Leave</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Holiday Calendar Modal */}
      <Dialog open={holidayModal} onOpenChange={setHolidayModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Holiday Calendar 2026</DialogTitle><DialogDescription>Company holidays for the current year</DialogDescription></DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Holiday</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { date: "26 Jan", name: "Republic Day", type: "National" },
                { date: "14 Apr", name: "Dr. Ambedkar Jayanti", type: "National" },
                { date: "01 May", name: "May Day", type: "National" },
                { date: "15 Aug", name: "Independence Day", type: "National" },
                { date: "02 Oct", name: "Gandhi Jayanti", type: "National" },
                { date: "25 Dec", name: "Christmas", type: "Optional" },
              ].map((h) => (
                <TableRow key={h.date}><TableCell className="font-medium">{h.date}</TableCell><TableCell>{h.name}</TableCell><TableCell><Badge variant="secondary" className="text-[10px]">{h.type}</Badge></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter><Button variant="outline" onClick={() => setHolidayModal(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Leave;
