import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, Upload, Calendar, Clock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type DayStatus = "P" | "A" | "L" | "H" | "WFH" | null;

interface DayData { date: number; status: DayStatus; inTime?: string; outTime?: string; }

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  P: { label: "P", bg: "bg-kpi-green/15", text: "text-kpi-green" },
  A: { label: "A", bg: "bg-destructive/15", text: "text-destructive" },
  L: { label: "L", bg: "bg-primary/15", text: "text-primary" },
  H: { label: "H", bg: "bg-muted", text: "text-muted-foreground" },
  WFH: { label: "WFH", bg: "bg-kpi-purple/15", text: "text-kpi-purple" },
};

const generateMarchData = (): DayData[] => {
  const statuses: DayStatus[] = ["P","P","P","P","P","H","H","P","P","A","P","P","P","H","H","P","L","P","P","P","H","H","P","P","P","WFH","P","H","H","P","P"];
  const inTimes = ["09:02","08:55","09:10","09:00","09:15","","","08:50","09:05","","09:01","09:08","08:58","","","09:12","","09:00","08:45","09:03","","","09:07","09:00","08:59","09:30","09:02","","","09:10","09:05"];
  const outTimes = ["18:30","18:00","18:45","18:15","18:00","","","18:20","18:10","","18:35","18:00","18:25","","","18:05","","18:40","19:00","18:15","","","18:30","18:00","18:20","17:30","18:45","","","18:00","18:30"];
  return Array.from({ length: 31 }, (_, i) => ({ date: i + 1, status: statuses[i], inTime: inTimes[i] || undefined, outTime: outTimes[i] || undefined }));
};

interface CorrectionRequest { date: string; requested: string; status: string; managerNote: string; submittedOn: string; }

const initialRequests: CorrectionRequest[] = [
  { date: "05 Mar 2026", requested: "Forgot to Punch Out", status: "Approved", managerNote: "Verified with CCTV logs", submittedOn: "06 Mar 2026" },
  { date: "10 Mar 2026", requested: "On-site Visit", status: "Pending", managerNote: "—", submittedOn: "11 Mar 2026" },
  { date: "02 Mar 2026", requested: "Work from Home", status: "Rejected", managerNote: "WFH not pre-approved for this date. Please apply in advance next time.", submittedOn: "03 Mar 2026" },
];

const AttendanceCorrection = () => {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const marchData = generateMarchData();
  const [requests, setRequests] = useState<CorrectionRequest[]>(initialRequests);

  // Form state
  const [correctionType, setCorrectionType] = useState("forgot-in");
  const [inTime, setInTime] = useState("09:05");
  const [outTime, setOutTime] = useState("18:30");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const firstDayOffset = 6;
  const weekDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  const handleDayClick = (day: DayData) => {
    setSelectedDay(day);
    setCorrectionType("forgot-in");
    setInTime("09:05");
    setOutTime("18:30");
    setReason("");
    setReasonError("");
    setModalOpen(true);
  };

  const handleSubmit = () => {
    if (reason.trim().length < 10) {
      setReasonError("Reason must be at least 10 characters");
      return;
    }
    const typeLabels: Record<string, string> = { "forgot-in": "Forgot to Punch In", "forgot-out": "Forgot to Punch Out", wfh: "Work from Home", onsite: "On-site Visit", other: "Other" };
    const today = new Date();
    const newReq: CorrectionRequest = {
      date: `${String(selectedDay?.date).padStart(2, "0")} Mar 2026`,
      requested: typeLabels[correctionType] || correctionType,
      status: "Pending",
      managerNote: "—",
      submittedOn: `${String(today.getDate()).padStart(2, "0")} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][today.getMonth()]} ${today.getFullYear()}`,
    };
    setRequests((prev) => [newReq, ...prev]);
    toast.success("Correction request submitted");
    setModalOpen(false);
  };

  const statusBadgeVariant = (status: string) => {
    if (status === "Approved") return "active" as const;
    if (status === "Pending") return "notice" as const;
    return "terminated" as const;
  };

  const calendarCells: (DayData | null)[] = [];
  for (let i = 0; i < firstDayOffset; i++) calendarCells.push(null);
  marchData.forEach((d) => calendarCells.push(d));
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">My Attendance</h1>
            <p className="text-sm text-muted-foreground">View and request corrections for your attendance</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4" /><span className="font-medium text-foreground">March 2026</span></div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Calendar Grid */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Monthly Attendance</CardTitle>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className={`inline-block w-3 h-3 rounded-sm ${cfg.bg}`} />
                    {key === "P" ? "Present" : key === "A" ? "Absent" : key === "L" ? "Leave" : key === "H" ? "Holiday" : "WFH"}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map((d) => (<div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={idx} className="aspect-square" />;
                const cfg = cell.status ? statusConfig[cell.status] : null;
                const isToday = cell.date === 14;
                return (
                  <button key={idx} onClick={() => handleDayClick(cell)} className={`aspect-square rounded-lg border p-1.5 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors hover:border-primary/50 hover:shadow-sm ${isToday ? "border-primary ring-1 ring-primary/30" : "border-border"}`}>
                    <span className={`font-medium ${isToday ? "text-primary" : "text-foreground"}`}>{cell.date}</span>
                    {cfg && (<span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>)}
                    {cell.inTime && (<span className="text-[9px] text-muted-foreground leading-none">{cell.inTime}</span>)}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Correction Requests Table */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">My Correction Requests</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Requested</TableHead><TableHead>Status</TableHead><TableHead>Manager's Note</TableHead><TableHead>Submitted On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{req.date}</TableCell>
                    <TableCell>{req.requested}</TableCell>
                    <TableCell><Badge variant={statusBadgeVariant(req.status)}>{req.status}</Badge></TableCell>
                    <TableCell className="max-w-[200px]">
                      {req.status === "Rejected" ? (
                        <Tooltip><TooltipTrigger asChild><span className="text-destructive cursor-help truncate block">{req.managerNote}</span></TooltipTrigger><TooltipContent className="max-w-xs"><p>{req.managerNote}</p></TooltipContent></Tooltip>
                      ) : (<span className="text-muted-foreground">{req.managerNote}</span>)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{req.submittedOn}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Correction Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Request Attendance Correction</DialogTitle>
            <DialogDescription>Submit a correction for your attendance record</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Date</Label><Input value={selectedDay ? `${selectedDay.date} March 2026` : ""} readOnly className="bg-muted" /></div>
            {selectedDay && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Current Record</p>
                <p className="text-sm font-medium text-destructive">
                  {selectedDay.status === "A" ? "Absent — No punch recorded" : selectedDay.status === "P" ? `Present — In: ${selectedDay.inTime} | Out: ${selectedDay.outTime}` : selectedDay.status === "L" ? "On Leave" : selectedDay.status === "H" ? "Holiday / Weekend" : `WFH — In: ${selectedDay.inTime} | Out: ${selectedDay.outTime}`}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Correction Type</Label>
              <Select value={correctionType} onValueChange={setCorrectionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="forgot-in">Forgot to Punch In</SelectItem>
                  <SelectItem value="forgot-out">Forgot to Punch Out</SelectItem>
                  <SelectItem value="wfh">Work from Home</SelectItem>
                  <SelectItem value="onsite">On-site Visit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Actual In Time</Label><Input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Actual Out Time</Label><Input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea value={reason} onChange={(e) => { setReason(e.target.value); setReasonError(""); }} placeholder="Please explain why your attendance needs correction..." className={`min-h-[80px] ${reasonError ? "border-destructive" : ""}`} />
              {reasonError && <p className="text-sm text-destructive">{reasonError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Supporting Document <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <label className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-3 cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-colors">
                <Upload className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Click to upload</span><input type="file" className="hidden" />
              </label>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceCorrection;
