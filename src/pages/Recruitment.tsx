import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus, MapPin, Users, Calendar, FileText, X, GripVertical, Star, Phone, Mail, ExternalLink, ChevronRight, Clock, ArrowRight, Briefcase,
} from "lucide-react";
import { toast } from "sonner";

/* ─── data ─── */

interface Candidate {
  id: string; name: string; initials: string; company: string; experience: string; matchScore: number; source: "LinkedIn" | "Referral" | "Website" | "Naukri"; daysInStage: number;
  email?: string; phone?: string; role?: string; summary?: string; aiNotes?: string; ratings?: { name: string; score: number }[]; timeline?: { date: string; action: string }[];
}

interface Stage { id: string; label: string; color: string; bgColor: string; borderColor: string; candidates: Candidate[]; }

interface Job { id: string; title: string; count: number; dept: string; location: string; openings: number; posted: string; }

const initialJobs: Job[] = [
  { id: "j1", title: "Senior Backend Engineer", count: 5, dept: "Engineering", location: "Bangalore", openings: 2, posted: "15 Jan 2026" },
  { id: "j2", title: "UI/UX Designer", count: 12, dept: "Design", location: "Mumbai", openings: 1, posted: "02 Feb 2026" },
  { id: "j3", title: "Sales Manager", count: 3, dept: "Sales", location: "Delhi", openings: 1, posted: "20 Feb 2026" },
];

const makeCandidates = (): Stage[] => [
  { id: "applied", label: "Applied", color: "text-muted-foreground", bgColor: "bg-muted", borderColor: "border-muted-foreground/30", candidates: [
    { id: "c1", name: "Ankit Verma", initials: "AV", company: "Flipkart", experience: "5 yrs", matchScore: 87, source: "LinkedIn", daysInStage: 2 },
    { id: "c2", name: "Pooja Nair", initials: "PN", company: "Zoho", experience: "3 yrs", matchScore: 72, source: "Website", daysInStage: 1 },
    { id: "c3", name: "Ravi Kumar", initials: "RK", company: "TCS", experience: "6 yrs", matchScore: 58, source: "Naukri", daysInStage: 5 },
    { id: "c4", name: "Sneha Iyer", initials: "SI", company: "Freshworks", experience: "4 yrs", matchScore: 81, source: "Referral", daysInStage: 1 },
    { id: "c5", name: "Karan Singh", initials: "KS", company: "Razorpay", experience: "7 yrs", matchScore: 91, source: "LinkedIn", daysInStage: 3 },
    { id: "c6", name: "Meena Das", initials: "MD", company: "Infosys", experience: "2 yrs", matchScore: 45, source: "Website", daysInStage: 4 },
    { id: "c7", name: "Aditya Rao", initials: "AR", company: "Wipro", experience: "4 yrs", matchScore: 66, source: "Naukri", daysInStage: 6 },
    { id: "c8", name: "Priya Menon", initials: "PM", company: "Swiggy", experience: "3 yrs", matchScore: 78, source: "Referral", daysInStage: 2 },
  ]},
  { id: "screening", label: "Screening", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/40", borderColor: "border-blue-400/40", candidates: [
    { id: "c9", name: "Vikram Joshi", initials: "VJ", company: "Paytm", experience: "5 yrs", matchScore: 84, source: "LinkedIn", daysInStage: 3 },
    { id: "c10", name: "Divya Sharma", initials: "DS", company: "PhonePe", experience: "4 yrs", matchScore: 79, source: "Referral", daysInStage: 2 },
    { id: "c11", name: "Rohit Pillai", initials: "RP", company: "Oracle", experience: "8 yrs", matchScore: 92, source: "LinkedIn", daysInStage: 1, email: "rohit.p@email.com", phone: "+91 98765 43210", role: "Senior Software Engineer at Oracle", summary: "8 years of experience building distributed systems.", aiNotes: "Strong Node.js background. Proceed to technical interview.", ratings: [{ name: "Priya (HR)", score: 4 }, { name: "Amit (Tech Lead)", score: 5 }], timeline: [{ date: "18 Jan 2026", action: "Applied via LinkedIn" }, { date: "20 Jan 2026", action: "Moved to Screening" }] },
    { id: "c12", name: "Tanvi Reddy", initials: "TR", company: "Amazon", experience: "6 yrs", matchScore: 88, source: "Website", daysInStage: 4 },
    { id: "c13", name: "Nikhil Gupta", initials: "NG", company: "Mindtree", experience: "3 yrs", matchScore: 62, source: "Naukri", daysInStage: 5 },
  ]},
  { id: "interview", label: "Interview", color: "text-yellow-700 dark:text-yellow-400", bgColor: "bg-yellow-50 dark:bg-yellow-950/40", borderColor: "border-yellow-400/40", candidates: [
    { id: "c14", name: "Arjun Mehta", initials: "AM", company: "Uber", experience: "6 yrs", matchScore: 90, source: "LinkedIn", daysInStage: 2 },
    { id: "c15", name: "Sanya Kapoor", initials: "SK", company: "Microsoft", experience: "5 yrs", matchScore: 85, source: "Referral", daysInStage: 4 },
    { id: "c16", name: "Deepak Nair", initials: "DN", company: "Google", experience: "7 yrs", matchScore: 94, source: "LinkedIn", daysInStage: 1 },
    { id: "c17", name: "Isha Bansal", initials: "IB", company: "Atlassian", experience: "4 yrs", matchScore: 76, source: "Website", daysInStage: 3 },
  ]},
  { id: "final", label: "Final Round", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/40", borderColor: "border-purple-400/40", candidates: [
    { id: "c18", name: "Manish Tiwari", initials: "MT", company: "Stripe", experience: "8 yrs", matchScore: 93, source: "LinkedIn", daysInStage: 2 },
    { id: "c19", name: "Lakshmi Prasad", initials: "LP", company: "Walmart Labs", experience: "6 yrs", matchScore: 89, source: "Referral", daysInStage: 1 },
    { id: "c20", name: "Suresh Babu", initials: "SB", company: "Intuit", experience: "5 yrs", matchScore: 82, source: "LinkedIn", daysInStage: 3 },
  ]},
  { id: "offer", label: "Offer", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950/40", borderColor: "border-green-400/40", candidates: [
    { id: "c21", name: "Neha Kulkarni", initials: "NK", company: "Adobe", experience: "7 yrs", matchScore: 95, source: "LinkedIn", daysInStage: 1 },
    { id: "c22", name: "Amit Saxena", initials: "AS", company: "SAP Labs", experience: "9 yrs", matchScore: 91, source: "Referral", daysInStage: 2 },
  ]},
];

const initialRejected: Candidate[] = [
  { id: "r1", name: "Vishal Garg", initials: "VG", company: "HCL", experience: "2 yrs", matchScore: 34, source: "Naukri", daysInStage: 8 },
  { id: "r2", name: "Rashmi Jain", initials: "RJ", company: "Cognizant", experience: "3 yrs", matchScore: 41, source: "Website", daysInStage: 6 },
];

/* ─── helpers ─── */

const MatchBadge = ({ score }: { score: number }) => {
  const color = score >= 80 ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : score >= 60 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{score}% Match</span>;
};

const SourceTag = ({ source }: { source: string }) => {
  const map: Record<string, string> = { LinkedIn: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", Referral: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", Website: "bg-muted text-muted-foreground", Naukri: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${map[source] ?? "bg-muted text-muted-foreground"}`}>{source}</span>;
};

const StarRating = ({ score, interactive, onChange }: { score: number; interactive?: boolean; onChange?: (s: number) => void }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={`h-3 w-3 ${i < score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"} ${interactive ? "cursor-pointer" : ""}`}
        onClick={interactive && onChange ? () => onChange(i + 1) : undefined} />
    ))}
  </div>
);

/* ─── Candidate Card ─── */

const CandidateCard = ({ c, onClick, isSelected, onSchedule, onResume, onReject }: {
  c: Candidate; onClick: () => void; isSelected: boolean; onSchedule: () => void; onResume: () => void; onReject: () => void;
}) => (
  <button onClick={onClick} className={`w-full text-left rounded-lg border bg-card p-3 space-y-2 hover:shadow-md transition-shadow cursor-pointer ${isSelected ? "ring-2 ring-primary" : ""}`}>
    <div className="flex items-start gap-2">
      <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
      <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{c.initials}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
        <p className="text-xs text-muted-foreground truncate">{c.company} · {c.experience}</p>
      </div>
    </div>
    <div className="flex items-center gap-1.5 flex-wrap"><MatchBadge score={c.matchScore} /><SourceTag source={c.source} /></div>
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {c.daysInStage}d in stage</span>
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted cursor-pointer" title="Schedule Interview" onClick={onSchedule}><Calendar className="h-3.5 w-3.5 text-muted-foreground" /></span>
        <span className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted cursor-pointer" title="View Resume" onClick={onResume}><FileText className="h-3.5 w-3.5 text-muted-foreground" /></span>
        <span className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-destructive/10 cursor-pointer" title="Reject" onClick={onReject}><X className="h-3.5 w-3.5 text-destructive" /></span>
      </div>
    </div>
  </button>
);

/* ─── Detail Panel ─── */

const DetailPanel = ({ c, onClose, onSchedule, onReject }: { c: Candidate; onClose: () => void; onSchedule: () => void; onReject: () => void }) => {
  const candidate = {
    ...c,
    email: c.email ?? `${c.name.split(" ")[0].toLowerCase()}@email.com`,
    phone: c.phone ?? "+91 98765 43210",
    role: c.role ?? `${c.experience} at ${c.company}`,
    summary: c.summary ?? `Experienced professional with ${c.experience} of industry experience at ${c.company}.`,
    aiNotes: c.aiNotes ?? "Strong background. Recommendation: Proceed to next stage.",
    ratings: c.ratings ?? [{ name: "Priya (HR)", score: 4 }, { name: "Amit (Tech Lead)", score: 5 }],
    timeline: c.timeline ?? [{ date: "18 Jan 2026", action: "Applied via " + c.source }, { date: "20 Jan 2026", action: "Moved to Screening" }],
  };

  return (
    <div className="w-[360px] shrink-0 border-l bg-card flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-foreground">Candidate Details</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12"><AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">{candidate.initials}</AvatarFallback></Avatar>
            <div><p className="font-semibold text-foreground">{candidate.name}</p><p className="text-sm text-muted-foreground">{candidate.role}</p></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {candidate.email}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {candidate.phone}</div>
          </div>
          <div className="flex gap-1.5"><MatchBadge score={candidate.matchScore} /><SourceTag source={candidate.source} /></div>
          <Separator />
          <div><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resume Summary</h4><p className="text-sm text-foreground leading-relaxed">{candidate.summary}</p></div>
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3"><h4 className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">🤖 AI Screening Notes</h4><p className="text-sm text-foreground leading-relaxed">{candidate.aiNotes}</p></div>
          <Separator />
          <div><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Interview Ratings</h4>
            <div className="space-y-2">{candidate.ratings.map((r) => (<div key={r.name} className="flex items-center justify-between"><span className="text-sm text-foreground">{r.name}</span><StarRating score={r.score} /></div>))}</div>
          </div>
          <Separator />
          <div><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Timeline</h4>
            <div className="space-y-3">{candidate.timeline.map((t, i) => (<div key={i} className="flex gap-3"><div className="flex flex-col items-center"><div className="h-2 w-2 rounded-full bg-primary mt-1.5" />{i < candidate.timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}</div><div><p className="text-sm text-foreground">{t.action}</p><p className="text-xs text-muted-foreground">{t.date}</p></div></div>))}</div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Button className="w-full" size="sm" onClick={onSchedule}><Calendar className="mr-1.5 h-4 w-4" /> Schedule Interview</Button>
            <Button variant="outline" className="w-full" size="sm" onClick={() => toast.success(`${candidate.name} moved to next stage`)}><ArrowRight className="mr-1.5 h-4 w-4" /> Move to Next Stage</Button>
            <Button variant="destructive" className="w-full" size="sm" onClick={onReject}><X className="mr-1.5 h-4 w-4" /> Send Rejection</Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

/* ─── Page ─── */

const Recruitment = () => {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [activeJob, setActiveJob] = useState(initialJobs[0].id);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [stages, setStages] = useState(makeCandidates());
  const [rejectedCandidates, setRejectedCandidates] = useState(initialRejected);

  // Modals
  const [postJobModal, setPostJobModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<Candidate | null>(null);
  const [resumeModal, setResumeModal] = useState<Candidate | null>(null);
  const [rejectModal, setRejectModal] = useState<Candidate | null>(null);

  // Post Job form
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobDept, setNewJobDept] = useState("");
  const [newJobLocation, setNewJobLocation] = useState("");
  const [newJobOpenings, setNewJobOpenings] = useState("1");
  const [newJobDesc, setNewJobDesc] = useState("");

  // Schedule form
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [schedInterviewer, setSchedInterviewer] = useState("");
  const [schedNotes, setSchedNotes] = useState("");

  const job = jobs.find((j) => j.id === activeJob)!;

  const handlePostJob = () => {
    if (!newJobTitle) return;
    const newJob: Job = { id: `j${Date.now()}`, title: newJobTitle, count: 0, dept: newJobDept || "General", location: newJobLocation || "Remote", openings: Number(newJobOpenings) || 1, posted: "06 Apr 2026" };
    setJobs([...jobs, newJob]);
    setActiveJob(newJob.id);
    toast.success("Job posted successfully");
    setPostJobModal(false);
    setNewJobTitle(""); setNewJobDept(""); setNewJobLocation(""); setNewJobOpenings("1"); setNewJobDesc("");
  };

  const handleSchedule = () => {
    toast.success("Interview scheduled");
    setScheduleModal(null);
    setSchedDate(""); setSchedTime(""); setSchedInterviewer(""); setSchedNotes("");
  };

  const handleReject = () => {
    if (rejectModal) {
      setRejectedCandidates([...rejectedCandidates, rejectModal]);
      setStages((prev) => prev.map((s) => ({ ...s, candidates: s.candidates.filter((c) => c.id !== rejectModal.id) })));
      if (selectedCandidate?.id === rejectModal.id) setSelectedCandidate(null);
      toast.success("Rejection email sent");
    }
    setRejectModal(null);
  };

  return (
    <AppLayout title="Recruitment">
      <div className="space-y-4 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Recruitment</h1>
          <Button onClick={() => setPostJobModal(true)}><Plus className="mr-1.5 h-4 w-4" /> Post New Job</Button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {jobs.map((j) => (
            <button key={j.id} onClick={() => { setActiveJob(j.id); setSelectedCandidate(null); }}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${j.id === activeJob ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}>
              {j.title} <span className="opacity-70">({j.count})</span>
            </button>
          ))}
          <button className="shrink-0 h-9 w-9 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" onClick={() => setPostJobModal(true)}>
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span className="font-semibold text-foreground">{job.title}</span>
            <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {job.dept}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {job.openings} Openings</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Posted {job.posted}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View Job Post</Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><X className="mr-1.5 h-3.5 w-3.5" /> Close Job</Button>
          </div>
        </div>

        {/* Kanban + Detail Panel */}
        <div className="flex flex-1 min-h-0 gap-0">
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 h-full min-w-max pb-2">
              {stages.map((stage) => (
                <div key={stage.id} className="w-[240px] shrink-0 flex flex-col">
                  <div className={`rounded-t-lg px-3 py-2 ${stage.bgColor} border ${stage.borderColor} border-b-0`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${stage.color}`}>{stage.label}</span>
                      <Badge variant="secondary" className="text-[10px] h-5">{stage.candidates.length}</Badge>
                    </div>
                  </div>
                  <div className={`flex-1 overflow-y-auto rounded-b-lg border ${stage.borderColor} border-t-0 bg-muted/30 p-2 space-y-2`}>
                    {stage.candidates.map((c) => (
                      <CandidateCard key={c.id} c={c} onClick={() => setSelectedCandidate(c)} isSelected={selectedCandidate?.id === c.id}
                        onSchedule={() => setScheduleModal(c)} onResume={() => setResumeModal(c)} onReject={() => setRejectModal(c)} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="w-[240px] shrink-0 flex flex-col">
                <div className="rounded-t-lg px-3 py-2 bg-red-50 dark:bg-red-950/40 border border-red-400/40 border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-red-700 dark:text-red-400">Rejected</span>
                    <Badge variant="secondary" className="text-[10px] h-5">{rejectedCandidates.length}</Badge>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto rounded-b-lg border border-red-400/40 border-t-0 bg-muted/30 p-2 space-y-2">
                  {rejectedCandidates.map((c) => (
                    <CandidateCard key={c.id} c={c} onClick={() => setSelectedCandidate(c)} isSelected={selectedCandidate?.id === c.id}
                      onSchedule={() => {}} onResume={() => setResumeModal(c)} onReject={() => {}} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {selectedCandidate && <DetailPanel c={selectedCandidate} onClose={() => setSelectedCandidate(null)} onSchedule={() => setScheduleModal(selectedCandidate)} onReject={() => setRejectModal(selectedCandidate)} />}
        </div>
      </div>

      {/* Post Job Modal */}
      <Dialog open={postJobModal} onOpenChange={setPostJobModal}>
        <DialogContent><DialogHeader><DialogTitle>Post New Job</DialogTitle><DialogDescription>Create a new job posting</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Job Title *</Label><Input value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="e.g. Senior Backend Engineer" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Department</Label><Select value={newJobDept} onValueChange={setNewJobDept}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{["Engineering","Design","Sales","HR","Finance","Operations"].map((d)=>(<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Location</Label><Input value={newJobLocation} onChange={(e) => setNewJobLocation(e.target.value)} placeholder="e.g. Bangalore" /></div>
            </div>
            <div className="space-y-1.5"><Label>Number of Openings</Label><Input type="number" min={1} value={newJobOpenings} onChange={(e) => setNewJobOpenings(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Job Description</Label><Textarea value={newJobDesc} onChange={(e) => setNewJobDesc(e.target.value)} placeholder="Describe the role..." rows={4} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPostJobModal(false)}>Cancel</Button><Button onClick={handlePostJob} disabled={!newJobTitle}>Post Job</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Interview Modal */}
      <Dialog open={!!scheduleModal} onOpenChange={(o) => !o && setScheduleModal(null)}>
        <DialogContent><DialogHeader><DialogTitle>Schedule Interview</DialogTitle><DialogDescription>Schedule an interview with {scheduleModal?.name}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Time</Label><Input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Interviewer</Label><Select value={schedInterviewer} onValueChange={setSchedInterviewer}><SelectTrigger><SelectValue placeholder="Select interviewer" /></SelectTrigger><SelectContent><SelectItem value="priya">Priya Patel (HR)</SelectItem><SelectItem value="amit">Amit Singh (Tech Lead)</SelectItem><SelectItem value="vikram">Vikram Malhotra (Eng Manager)</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={schedNotes} onChange={(e) => setSchedNotes(e.target.value)} placeholder="Any notes..." rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setScheduleModal(null)}>Cancel</Button><Button onClick={handleSchedule}>Schedule</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resume Modal */}
      <Dialog open={!!resumeModal} onOpenChange={(o) => !o && setResumeModal(null)}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Resume — {resumeModal?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm text-foreground">
            <div><h4 className="font-semibold mb-1">Professional Summary</h4><p className="text-muted-foreground">Experienced {resumeModal?.experience} professional from {resumeModal?.company} with strong technical skills in backend development, distributed systems, and cloud architecture.</p></div>
            <Separator />
            <div><h4 className="font-semibold mb-1">Experience</h4><p className="text-muted-foreground">{resumeModal?.company} — {resumeModal?.experience}</p></div>
            <div><h4 className="font-semibold mb-1">Skills</h4><div className="flex flex-wrap gap-1.5">{["Node.js","Python","PostgreSQL","AWS","Docker","Kubernetes"].map((s) => (<Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>))}</div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setResumeModal(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent><DialogHeader><DialogTitle>Send Rejection</DialogTitle><DialogDescription>Send a rejection email to {rejectModal?.name}</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Label>Email Preview</Label>
            <div className="rounded-md border p-3 text-sm text-muted-foreground bg-muted/50">
              <p>Dear {rejectModal?.name},</p><br />
              <p>Thank you for taking the time to apply for the position at our company. After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p><br />
              <p>We appreciate your interest and wish you the best in your future endeavors.</p><br />
              <p>Best regards,<br />HR Team</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button><Button variant="destructive" onClick={handleReject}>Send Rejection</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Recruitment;
