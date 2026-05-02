import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  CalendarIcon, Upload, ChevronRight, Home, User, LogOut, CheckCircle2,
} from "lucide-react";

/* ── data ─────────────────────────────────────── */

const leaveTypes = [
  { value: "CL", label: "Casual Leave (CL)", remaining: 8, total: 12 },
  { value: "SL", label: "Sick Leave (SL)", remaining: 12, total: 12 },
  { value: "PL", label: "Earned Leave (PL)", remaining: 18, total: 24 },
  { value: "ML", label: "Comp Off", remaining: 2, total: 3 },
];

const recentHistory = [
  { id: 1, type: "CL", from: "10 Feb 2026", to: "11 Feb 2026", days: 2, status: "Approved" },
  { id: 2, type: "SL", from: "28 Jan 2026", to: "28 Jan 2026", days: 1, status: "Approved" },
  { id: 3, type: "PL", from: "20 Dec 2025", to: "24 Dec 2025", days: 3, status: "Approved" },
  { id: 4, type: "CL", from: "05 Dec 2025", to: "05 Dec 2025", days: 1, status: "Rejected" },
  { id: 5, type: "SL", from: "15 Nov 2025", to: "16 Nov 2025", days: 2, status: "Approved" },
];

const statusVariant = (s: string) => {
  if (s === "Approved") return "active" as const;
  if (s === "Pending") return "notice" as const;
  return "terminated" as const;
};

const balanceColor: Record<string, string> = {
  CL: "bg-primary", SL: "bg-kpi-green", PL: "bg-kpi-amber", ML: "bg-kpi-purple",
};

/* ── component ────────────────────────────────── */

const ApplyLeave = () => {
  const [leaveType, setLeaveType] = useState("");
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [halfDay, setHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"first" | "second">("first");
  const [reason, setReason] = useState("");
  const [notifyHR, setNotifyHR] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const workingDays = useMemo(() => {
    if (!fromDate || !toDate || toDate < fromDate) return 0;
    const days = eachDayOfInterval({ start: fromDate, end: toDate });
    let count = days.filter((d) => !isWeekend(d)).length;
    if (halfDay && count > 0) count = count - 0.5;
    return count;
  }, [fromDate, toDate, halfDay]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!leaveType) errs.leaveType = "Leave type is required";
    if (!fromDate) errs.fromDate = "From date is required";
    if (!toDate) errs.toDate = "To date is required";
    if (!reason.trim()) errs.reason = "Reason is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSubmitted(true);
  };

  const resetForm = () => {
    setLeaveType(""); setFromDate(undefined); setToDate(undefined);
    setHalfDay(false); setReason(""); setNotifyHR(false);
    setSubmitted(false); setErrors({});
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">KYZEN</Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/attendance/correction" className="hover:text-foreground transition-colors">Attendance</Link>
            <Link href="/leave/apply" className="text-primary">Leave</Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-4 w-4 text-primary" /></div>
              <span className="hidden sm:inline text-sm font-medium">Rahul Sharma</span>
            </div>
            <button className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5">
          <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1"><Home className="h-3.5 w-3.5" /> Home</Link>
          <ChevronRight className="h-3 w-3" /><span>Leave</span><ChevronRight className="h-3 w-3" /><span className="text-foreground font-medium">Apply</span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Apply for Leave</h1>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* ── Left: Form ────────────────────────── */}
          <Card className="lg:col-span-3">
            <CardContent className="p-6 space-y-5">
              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-full bg-kpi-green/15 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-kpi-green" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Leave request submitted successfully</h3>
                  <p className="text-sm text-muted-foreground">Your manager will be notified.</p>
                  <Button variant="link" onClick={resetForm}>Apply for another leave</Button>
                </div>
              ) : (
                <>
                  {/* Leave type */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Leave Type <span className="text-destructive">*</span></Label>
                    <Select value={leaveType} onValueChange={(v) => { setLeaveType(v); setErrors((e) => ({ ...e, leaveType: "" })); }}>
                      <SelectTrigger className={errors.leaveType ? "border-destructive" : ""}><SelectValue placeholder="Select leave type" /></SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label} — <span className="text-muted-foreground">{t.remaining} days remaining</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.leaveType && <p className="text-sm text-destructive">{errors.leaveType}</p>}
                  </div>

                  {/* Date pickers */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">From Date <span className="text-destructive">*</span></Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fromDate && "text-muted-foreground", errors.fromDate && "border-destructive")}>
                            <CalendarIcon className="h-4 w-4 mr-2 opacity-60" />
                            {fromDate ? format(fromDate, "dd MMM yyyy") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={fromDate} onSelect={(d) => { setFromDate(d); setErrors((e) => ({ ...e, fromDate: "" })); }} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      {errors.fromDate && <p className="text-sm text-destructive">{errors.fromDate}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">To Date <span className="text-destructive">*</span></Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !toDate && "text-muted-foreground", errors.toDate && "border-destructive")}>
                            <CalendarIcon className="h-4 w-4 mr-2 opacity-60" />
                            {toDate ? format(toDate, "dd MMM yyyy") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={toDate} onSelect={(d) => { setToDate(d); setErrors((e) => ({ ...e, toDate: "" })); }} disabled={(d) => fromDate ? d < fromDate : false} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      {errors.toDate && <p className="text-sm text-destructive">{errors.toDate}</p>}
                    </div>
                  </div>

                  {fromDate && toDate && toDate >= fromDate && (
                    <div><Badge variant="leave" className="text-sm px-3 py-1">{workingDays} working day{workingDays !== 1 ? "s" : ""}</Badge></div>
                  )}

                  {/* Half day */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id="halfday" checked={halfDay} onCheckedChange={(v) => setHalfDay(!!v)} />
                      <Label htmlFor="halfday" className="text-sm cursor-pointer">Apply for half day</Label>
                    </div>
                    {halfDay && (
                      <div className="flex gap-2 ml-6">
                        <Button type="button" size="sm" variant={halfDayPeriod === "first" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setHalfDayPeriod("first")}>First Half</Button>
                        <Button type="button" size="sm" variant={halfDayPeriod === "second" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setHalfDayPeriod("second")}>Second Half</Button>
                      </div>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Reason <span className="text-destructive">*</span></Label>
                    <Textarea value={reason} onChange={(e) => { setReason(e.target.value); setErrors((er) => ({ ...er, reason: "" })); }} placeholder="Please explain the reason for your leave request..." rows={3} className={errors.reason ? "border-destructive" : ""} />
                    {errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}
                  </div>

                  {/* File upload */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Attach Document <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-secondary/50 transition-colors">
                      <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Click to upload or drag & drop</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">PDF, JPG, PNG up to 5MB</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="notify" checked={notifyHR} onCheckedChange={(v) => setNotifyHR(!!v)} />
                    <Label htmlFor="notify" className="text-sm cursor-pointer">Also notify HR Admin</Label>
                  </div>

                  <Button className="w-full h-11 text-sm font-semibold" onClick={handleSubmit}>Submit Leave Request</Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Right: Balances + History ──────────── */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">My Leave Balances</CardTitle></CardHeader>
              <CardContent className="space-y-4 pt-0">
                {leaveTypes.map((t) => {
                  const pct = (t.remaining / t.total) * 100;
                  return (
                    <div key={t.value} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{t.label.split("(")[0].trim()}</span>
                        <span className="text-muted-foreground tabular-nums text-xs">{t.remaining} / {t.total} days</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", balanceColor[t.value])} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Recent Leave History</CardTitle></CardHeader>
              <CardContent className="space-y-3 pt-0">
                {recentHistory.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm border-b last:border-0 pb-2.5 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Badge variant="leave" className="text-[10px] px-1.5 py-0">{r.type}</Badge>
                        <span className="text-xs text-muted-foreground">{r.days}d</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{r.from} – {r.to}</p>
                    </div>
                    <Badge variant={statusVariant(r.status)} className="shrink-0 text-[10px]">{r.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ApplyLeave;
