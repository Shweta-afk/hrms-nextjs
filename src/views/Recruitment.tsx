'use client'

import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
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
  Plus, MapPin, Users, Calendar, FileText, X, GripVertical, Star,
  Phone, Mail, Clock, ArrowRight, Briefcase, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  current_company: string | null;
  experience_years: number | null;
  stage: string;
  ai_score: number | null;
  ai_summary: string | null;
  source: string;
  job_posting_id: string;
  created_at: string;
}

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  openings: number;
  description: string;
  status: string;
  created_at: string;
  candidates: { id: string; stage: string }[];
}

const STAGES = [
  { id: 'applied', label: 'Applied', color: 'text-muted-foreground', bgColor: 'bg-muted', borderColor: 'border-muted-foreground/30' },
  { id: 'screening', label: 'Screening', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/40', borderColor: 'border-blue-400/40' },
  { id: 'interview', label: 'Interview', color: 'text-yellow-700 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950/40', borderColor: 'border-yellow-400/40' },
  { id: 'final', label: 'Final Round', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950/40', borderColor: 'border-purple-400/40' },
  { id: 'offer', label: 'Offer', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950/40', borderColor: 'border-green-400/40' },
  { id: 'rejected', label: 'Rejected', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950/40', borderColor: 'border-red-400/40' },
]

const STAGE_ORDER = ['applied', 'screening', 'interview', 'final', 'offer']

const MatchBadge = ({ score }: { score: number | null }) => {
  if (!score) return null
  const color = score >= 80
    ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
    : score >= 60
    ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
    : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{score}% Match</span>
}

const SourceTag = ({ source }: { source: string }) => {
  const map: Record<string, string> = {
    LinkedIn: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    Referral: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
    Website: 'bg-muted text-muted-foreground',
    Naukri: 'bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400',
  }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${map[source] ?? 'bg-muted text-muted-foreground'}`}>{source}</span>
}

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

const CandidateCard = ({ c, onClick, isSelected, onSchedule, onMoveNext, onReject }: {
  c: Candidate; onClick: () => void; isSelected: boolean;
  onSchedule: () => void; onMoveNext: () => void; onReject: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-lg border bg-card p-3 space-y-2 hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}
  >
    <div className="flex items-start gap-2">
      <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{getInitials(c.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {c.current_company ?? '—'} · {c.experience_years ? `${c.experience_years} yrs` : '—'}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-1.5 flex-wrap">
      <MatchBadge score={c.ai_score} />
      <SourceTag source={c.source} />
    </div>
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
      </span>
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <span className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted cursor-pointer" title="Schedule Interview" onClick={onSchedule}>
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        {c.stage !== 'offer' && c.stage !== 'rejected' && (
          <span className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted cursor-pointer" title="Move to Next Stage" onClick={onMoveNext}>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
        {c.stage !== 'rejected' && (
          <span className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-destructive/10 cursor-pointer" title="Reject" onClick={onReject}>
            <X className="h-3.5 w-3.5 text-destructive" />
          </span>
        )}
      </div>
    </div>
  </button>
)

const DetailPanel = ({ c, onClose, onSchedule, onMoveNext, onReject }: {
  c: Candidate; onClose: () => void;
  onSchedule: () => void; onMoveNext: () => void; onReject: () => void;
}) => (
  <div className="w-[360px] shrink-0 border-l bg-card flex flex-col h-full">
    <div className="flex items-center justify-between p-4 border-b">
      <h3 className="font-semibold text-foreground">Candidate Details</h3>
      <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
    </div>
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-5">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">{getInitials(c.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{c.name}</p>
            <p className="text-sm text-muted-foreground">
              {c.experience_years ? `${c.experience_years} yrs` : ''} {c.current_company ? `at ${c.current_company}` : ''}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> {c.email}
          </div>
          {c.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {c.phone}
            </div>
          )}
        </div>

        <div className="flex gap-1.5">
          <MatchBadge score={c.ai_score} />
          <SourceTag source={c.source} />
        </div>

        {c.ai_summary && (
          <>
            <Separator />
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">🤖 AI Screening Notes</h4>
              <p className="text-sm text-foreground leading-relaxed">{c.ai_summary}</p>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-2">
          <Badge variant="secondary" className="text-xs capitalize">{c.stage.replace('_', ' ')}</Badge>
          {c.stage !== 'rejected' && c.stage !== 'offer' && (
            <Button className="w-full" size="sm" onClick={onMoveNext}>
              <ArrowRight className="mr-1.5 h-4 w-4" /> Move to Next Stage
            </Button>
          )}
          <Button variant="outline" className="w-full" size="sm" onClick={onSchedule}>
            <Calendar className="mr-1.5 h-4 w-4" /> Schedule Interview
          </Button>
          {c.stage !== 'rejected' && (
            <Button variant="destructive" className="w-full" size="sm" onClick={onReject}>
              <X className="mr-1.5 h-4 w-4" /> Send Rejection
            </Button>
          )}
        </div>
      </div>
    </ScrollArea>
  </div>
)

const Recruitment = () => {
  const [jobs, setJobs] = useState<Job[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [activeJobId, setActiveJobId] = useState<string>('')
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)

  // Modals
  const [postJobModal, setPostJobModal] = useState(false)
  const [scheduleModal, setScheduleModal] = useState<Candidate | null>(null)
  const [rejectModal, setRejectModal] = useState<Candidate | null>(null)

  // Post job form
  const [newJob, setNewJob] = useState({ title: '', department: '', location: '', openings: '1', description: '' })
  const [posting, setPosting] = useState(false)

  // Schedule form
  const [sched, setSched] = useState({ date: '', time: '', interviewer: '', notes: '' })

  async function fetchJobs() {
    setLoading(true)
    try {
      const res = await fetch('/api/recruitment/jobs')
      const json = await res.json()
      if (json.success) {
        setJobs(json.data)
        if (json.data.length > 0 && !activeJobId) {
          setActiveJobId(json.data[0].id)
        }
      }
    } catch {
      toast.error('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  async function fetchCandidates(jobId: string) {
    try {
      const res = await fetch(`/api/recruitment/candidates?job_posting_id=${jobId}`)
      const json = await res.json()
      if (json.success) setCandidates(json.data)
    } catch {
      toast.error('Failed to load candidates')
    }
  }

  useEffect(() => { fetchJobs() }, [])
  useEffect(() => { if (activeJobId) fetchCandidates(activeJobId) }, [activeJobId])

  const activeJob = jobs.find(j => j.id === activeJobId)

  async function handlePostJob() {
    if (!newJob.title) return
    setPosting(true)
    try {
      const res = await fetch('/api/recruitment/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newJob.title,
          department: newJob.department || 'General',
          location: newJob.location || 'Remote',
          openings: parseInt(newJob.openings) || 1,
          description: newJob.description || 'No description provided',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Job posted successfully')
        setPostJobModal(false)
        setNewJob({ title: '', department: '', location: '', openings: '1', description: '' })
        fetchJobs()
        setActiveJobId(json.data.id)
      } else {
        toast.error(json.error)
      }
    } catch {
      toast.error('Failed to post job')
    } finally {
      setPosting(false)
    }
  }

  async function handleMoveNext(candidate: Candidate) {
    const currentIndex = STAGE_ORDER.indexOf(candidate.stage)
    if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) return
    const nextStage = STAGE_ORDER[currentIndex + 1]

    try {
      const res = await fetch(`/api/recruitment/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`${candidate.name} moved to ${nextStage}`)
        setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, stage: nextStage } : c))
        if (selectedCandidate?.id === candidate.id) {
          setSelectedCandidate({ ...candidate, stage: nextStage })
        }
      }
    } catch {
      toast.error('Failed to move candidate')
    }
  }

  async function handleReject(candidate: Candidate) {
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'rejected' }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Rejection email sent')
        setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...c, stage: 'rejected' } : c))
        if (selectedCandidate?.id === candidate.id) {
          setSelectedCandidate({ ...candidate, stage: 'rejected' })
        }
      }
    } catch {
      toast.error('Failed to reject candidate')
    }
    setRejectModal(null)
  }

  async function handleCloseJob() {
    if (!activeJobId) return
    try {
      const res = await fetch(`/api/recruitment/jobs/${activeJobId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('Job closed')
        fetchJobs()
      }
    } catch {
      toast.error('Failed to close job')
    }
  }

  function handleSchedule() {
    toast.success(`Interview scheduled for ${scheduleModal?.name}`)
    setScheduleModal(null)
    setSched({ date: '', time: '', interviewer: '', notes: '' })
  }

  const getCandidatesByStage = (stage: string) =>
    candidates.filter(c => c.stage === stage)

  if (loading) {
    return (
      <AppLayout title="Recruitment">
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Recruitment">
      <div className="space-y-4 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Recruitment</h1>
          <Button onClick={() => setPostJobModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Post New Job
          </Button>
        </div>

        {/* Job Tabs */}
        {jobs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No jobs posted yet.</p>
            <Button className="mt-3" onClick={() => setPostJobModal(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Post First Job
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {jobs.map(j => (
                <button
                  key={j.id}
                  onClick={() => { setActiveJobId(j.id); setSelectedCandidate(null) }}
                  className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${j.id === activeJobId ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}
                >
                  {j.title}
                  <span className="opacity-70 ml-1">({j.candidates.length})</span>
                  {j.status === 'closed' && <span className="ml-1 text-[10px] opacity-60">[closed]</span>}
                </button>
              ))}
              <button
                className="shrink-0 h-9 w-9 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-muted"
                onClick={() => setPostJobModal(true)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Job Details Bar */}
            {activeJob && (
              <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  <span className="font-semibold text-foreground">{activeJob.title}</span>
                  <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {activeJob.department}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {activeJob.location}</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {activeJob.openings} Opening{activeJob.openings > 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Posted {new Date(activeJob.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {activeJob.status === 'open' && (
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleCloseJob}>
                      <X className="mr-1.5 h-3.5 w-3.5" /> Close Job
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Kanban Board + Detail Panel */}
            <div className="flex flex-1 min-h-0 gap-0">
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-3 h-full min-w-max pb-2">
                  {STAGES.map(stage => {
                    const stageCandidates = getCandidatesByStage(stage.id)
                    return (
                      <div key={stage.id} className="w-[240px] shrink-0 flex flex-col">
                        <div className={`rounded-t-lg px-3 py-2 ${stage.bgColor} border ${stage.borderColor} border-b-0`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-semibold ${stage.color}`}>{stage.label}</span>
                            <Badge variant="secondary" className="text-[10px] h-5">{stageCandidates.length}</Badge>
                          </div>
                        </div>
                        <div className={`flex-1 overflow-y-auto rounded-b-lg border ${stage.borderColor} border-t-0 bg-muted/30 p-2 space-y-2 min-h-[200px]`}>
                          {stageCandidates.length === 0 ? (
                            <div className="text-center py-6 text-xs text-muted-foreground">No candidates</div>
                          ) : (
                            stageCandidates.map(c => (
                              <CandidateCard
                                key={c.id}
                                c={c}
                                onClick={() => setSelectedCandidate(c)}
                                isSelected={selectedCandidate?.id === c.id}
                                onSchedule={() => setScheduleModal(c)}
                                onMoveNext={() => handleMoveNext(c)}
                                onReject={() => setRejectModal(c)}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {selectedCandidate && (
                <DetailPanel
                  c={selectedCandidate}
                  onClose={() => setSelectedCandidate(null)}
                  onSchedule={() => setScheduleModal(selectedCandidate)}
                  onMoveNext={() => handleMoveNext(selectedCandidate)}
                  onReject={() => setRejectModal(selectedCandidate)}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Post Job Modal */}
      <Dialog open={postJobModal} onOpenChange={setPostJobModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post New Job</DialogTitle>
            <DialogDescription>Create a new job posting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Job Title *</Label>
              <Input value={newJob.title} onChange={e => setNewJob(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Senior Backend Engineer" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={newJob.department} onValueChange={v => setNewJob(p => ({ ...p, department: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {['Engineering','Design','Sales','HR','Finance','Operations'].map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={newJob.location} onChange={e => setNewJob(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Bangalore" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Number of Openings</Label>
              <Input type="number" min={1} value={newJob.openings} onChange={e => setNewJob(p => ({ ...p, openings: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Job Description</Label>
              <Textarea value={newJob.description} onChange={e => setNewJob(p => ({ ...p, description: e.target.value }))} placeholder="Describe the role..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostJobModal(false)}>Cancel</Button>
            <Button onClick={handlePostJob} disabled={!newJob.title || posting}>
              {posting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Posting...</> : 'Post Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Modal */}
      <Dialog open={!!scheduleModal} onOpenChange={o => !o && setScheduleModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>Schedule an interview with {scheduleModal?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={sched.date} onChange={e => setSched(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input type="time" value={sched.time} onChange={e => setSched(p => ({ ...p, time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Interviewer</Label>
              <Select value={sched.interviewer} onValueChange={v => setSched(p => ({ ...p, interviewer: v }))}>
                <SelectTrigger><SelectValue placeholder="Select interviewer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hr">HR Manager</SelectItem>
                  <SelectItem value="tech">Tech Lead</SelectItem>
                  <SelectItem value="mgr">Engineering Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={sched.notes} onChange={e => setSched(p => ({ ...p, notes: e.target.value }))} placeholder="Any notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleModal(null)}>Cancel</Button>
            <Button onClick={handleSchedule}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={!!rejectModal} onOpenChange={o => !o && setRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Rejection</DialogTitle>
            <DialogDescription>Send a rejection email to {rejectModal?.name}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-3 text-sm text-muted-foreground bg-muted/50 space-y-2">
            <p>Dear {rejectModal?.name},</p>
            <p>Thank you for applying. After careful consideration, we have decided to move forward with other candidates. We appreciate your interest and wish you the best in your job search.</p>
            <p>Best regards,<br />HR Team</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectModal && handleReject(rejectModal)}>Send Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default Recruitment