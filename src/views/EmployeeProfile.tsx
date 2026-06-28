'use client'

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pencil, MoreHorizontal, ArrowRightLeft, UserX, Copy, Loader2,
  ShieldCheck, AlertTriangle, Fingerprint, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, Wifi, WifiOff, Send, FolderOpen, ExternalLink, Download,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

/* ── Types ──────────────────────────────────────── */

interface Department { id: string; name: string }
interface Designation { id: string; name: string }
interface SalaryStructure { id: string; name: string }
interface Manager { id: string; first_name: string; last_name: string }

interface LeaveBalance {
  leave_type_id: string; name: string; code: string
  total: number; taken: number; available: number; is_paid: boolean
}

interface AttendanceRecord {
  id: string; date: string; status: string
  first_in: string | null; last_out: string | null; total_hours: number | null
}

interface LeaveRequest {
  id: string; from_date: string; to_date: string; total_days: number
  status: string; reason: string
  leave_type: { name: string; code: string }
}

interface Payslip {
  id: string; month: number; year: number; gross_salary: number; net_salary: number; is_published: boolean
}

interface Employee {
  id: string; emp_code: string; essl_device_id: string | null
  first_name: string; last_name: string; email: string; phone: string | null
  department_id: string | null; department: Department | null
  designation_id: string | null; designation: Designation | null
  manager_id: string | null; manager: Manager | null
  employment_type: string; status: string
  date_of_joining: string; ctc_annual: number | null; monthly_incentive: number | null
  salary_structure_id: string | null
  personal_info: Record<string, unknown>
  contact_info: Record<string, unknown>
  bank_details: Record<string, unknown> | null
  statutory_info: Record<string, unknown> | null
  attendance: AttendanceRecord[]
  leave_requests: LeaveRequest[]
  payslips: Payslip[]
}

interface EmployeeDoc {
  id: string; type: string; file_name: string; file_size: number | null
  notes: string | null; is_verified: boolean; url: string | null
  created_at: string; uploaded_by: string
}

const DOC_LABELS: Record<string, string> = {
  photo:                        'Profile Photo',
  aadhaar:                      'Aadhaar Card',
  pan:                          'PAN Card',
  address_proof:                'Address Proof',
  passbook_or_cancelled_cheque: 'Passbook / Cancelled Cheque',
  resume:                       'Resume / CV',
  leaving_certificate:          'Leaving Certificate',
  offer_letter:                 'Offer Letter',
  salary_slips:                 'Last 3-Month Salary Slips',
  bank_statement:               'Bank Statement (3 months)',
  pcc:                          'PCC Certificate',
  education_certificate:        'Education Certificate',
  dra_certificate:              'DRA Certificate',
}

interface DeviceEnrollmentData {
  device_id: string
  device_name: string
  device_location: string | null
  device_status: 'online' | 'idle' | 'offline' | 'never_connected'
  enrollment: {
    status: 'pending' | 'enrolled' | 'failed'
    synced_at: string | null
    enrolled_at: string | null
  } | null
}

/* ── Helpers ──────────────────────────────────── */

const InfoRow = ({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) => (
  <div className="flex flex-col gap-1 py-2.5">
    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-foreground">{value || '—'}</span>
      {badge}
    </div>
  </div>
)

const statusColor: Record<string, 'active' | 'notice' | 'terminated' | 'secondary'> = {
  active: 'active', on_notice: 'notice', terminated: 'terminated',
}

const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

/* ── Component ────────────────────────────────── */

interface Props { employeeId: string }

const EmployeeProfile = ({ employeeId }: Props) => {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [departments, setDepartments] = useState<Department[]>([])
  const [designations, setDesignations] = useState<Designation[]>([])
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])

  const [enrollments, setEnrollments] = useState<DeviceEnrollmentData[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [esslDeviceId, setEsslDeviceId] = useState('')
  const [savingEssl, setSavingEssl] = useState(false)
  const [syncingDevice, setSyncingDevice] = useState<string | null>(null)
  const [syncAllLoading, setSyncAllLoading] = useState(false)

  // Documents
  const [documents, setDocuments] = useState<EmployeeDoc[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [verifyingDoc, setVerifyingDoc] = useState<string | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [editPersonal, setEditPersonal] = useState(false)
  const [editEmployment, setEditEmployment] = useState(false)
  const [transferModal, setTransferModal] = useState(false)
  const [deactivateModal, setDeactivateModal] = useState(false)
  const [terminationReason, setTerminationReason] = useState('')
  const [lastWorkingDay, setLastWorkingDay] = useState('')
  const [copiedId, setCopiedId] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const router = useRouter()

  // Tab state is controlled (not just defaulted) so deep-links like
  // `/employees/[id]?tab=documents` from the dashboard's pending-verifications
  // panel land HR directly on the right tab. We also push tab changes back
  // to the URL so refresh/share preserves the active tab.
  const searchParams = useSearchParams()
  const VALID_TABS = ['personal', 'employment', 'attendance', 'leave', 'payroll', 'biometrics', 'documents'] as const
  type TabValue = typeof VALID_TABS[number]
  const urlTab = searchParams?.get('tab')
  const initialTab: TabValue = (VALID_TABS as readonly string[]).includes(urlTab ?? '')
    ? (urlTab as TabValue)
    : 'personal'
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab)
  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue)
    // Update URL without scroll-jump so refresh / browser-back keeps the tab.
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('tab', value)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // Draft state for edit forms
  const [personalDraft, setPersonalDraft] = useState<Partial<Employee>>({})
  const [empDraft, setEmpDraft] = useState<{
    emp_code: string; department_id: string; employment_type: string
    ctc_annual: string; monthly_incentive: string; salary_structure_id: string
    date_of_joining: string; designation_id: string
  }>({ emp_code: '', department_id: '', employment_type: '', ctc_annual: '', monthly_incentive: '', salary_structure_id: '', date_of_joining: '', designation_id: '' })
  const [transferDept, setTransferDept] = useState('')

  const fetchEmployee = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [empRes, deptRes, desgRes, structRes, balRes] = await Promise.all([
        fetch(`/api/employees/${employeeId}`),
        fetch('/api/departments'),
        fetch('/api/designations'),
        fetch('/api/payroll/structures'),
        fetch(`/api/leave/balance?employee_id=${employeeId}`),
      ])
      const [empJson, deptJson, desgJson, structJson, balJson] = await Promise.all([
        empRes.json(), deptRes.json(), desgRes.json(), structRes.json(), balRes.json(),
      ])
      if (empJson.success) {
        setEmployee(empJson.data)
        setEsslDeviceId(empJson.data.essl_device_id ?? '')
      } else setError(empJson.error || 'Employee not found')
      if (deptJson.success) setDepartments(deptJson.data)
      if (desgJson.success) setDesignations(desgJson.data)
      if (structJson.success) setSalaryStructures(structJson.data)
      if (balJson.success) setLeaveBalances(balJson.data)
    } catch {
      setError('Failed to load employee data')
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  const fetchEnrollments = useCallback(async () => {
    setEnrollmentsLoading(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/enrollments`)
      const json = await res.json()
      if (json.success) setEnrollments(json.data)
    } catch {
      // non-critical — biometrics tab is secondary
    } finally {
      setEnrollmentsLoading(false)
    }
  }, [employeeId])

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/documents`)
      const json = await res.json()
      if (json.success) setDocuments(json.data)
    } catch { /* non-critical */ }
    finally { setDocsLoading(false) }
  }, [employeeId])

  async function handleVerifyDoc(docId: string, verify: boolean) {
    setVerifyingDoc(docId)
    try {
      const res = await fetch(`/api/employees/${employeeId}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_verified: verify }),
      })
      const json = await res.json()
      if (json.success) { toast.success(verify ? 'Document verified' : 'Verification removed'); fetchDocuments() }
      else toast.error(json.error ?? 'Failed')
    } catch { toast.error('Failed') }
    finally { setVerifyingDoc(null) }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm('Delete this document?')) return
    setDeletingDoc(docId)
    try {
      const res = await fetch(`/api/employees/${employeeId}/documents/${docId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) { toast.success('Document deleted'); fetchDocuments() }
      else toast.error(json.error ?? 'Failed')
    } catch { toast.error('Failed') }
    finally { setDeletingDoc(null) }
  }

  const syncToDevice = async (deviceId: string) => {
    setSyncingDevice(deviceId)
    try {
      const res = await fetch(`/api/devices/${deviceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.data?.message ?? 'Pushed to device — employee must now scan their biometric')
        fetchEnrollments()
      } else {
        toast.error(json.error ?? 'Failed to sync to device')
      }
    } catch {
      toast.error('Network error while syncing to device')
    } finally {
      setSyncingDevice(null)
    }
  }

  const syncToAllDevices = async () => {
    if (enrollments.length === 0) return
    setSyncAllLoading(true)
    let ok = 0
    let fail = 0
    for (const d of enrollments) {
      try {
        const res = await fetch(`/api/devices/${d.device_id}/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: employeeId }),
        })
        const json = await res.json()
        if (json.success) { ok++ } else { fail++ }
      } catch {
        fail++
      }
    }
    if (ok > 0) toast.success(`Synced to ${ok} device${ok > 1 ? 's' : ''}`)
    if (fail > 0) toast.error(`Failed on ${fail} device${fail > 1 ? 's' : ''}`)
    setSyncAllLoading(false)
    fetchEnrollments()
  }

  const sendPortalInvite = async () => {
    setSendingInvite(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/invite`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        toast.success(json.warning ?? `Portal invite sent to ${employee?.email}`)
      } else {
        toast.error(json.error ?? 'Failed to send invite')
      }
    } catch {
      toast.error('Failed to send invite')
    } finally {
      setSendingInvite(false)
    }
  }

  const saveEsslDeviceId = async () => {
    setSavingEssl(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essl_device_id: esslDeviceId.trim() || null }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Device User ID saved')
        setEmployee((prev) => prev ? { ...prev, essl_device_id: esslDeviceId.trim() || null } : prev)
      } else {
        toast.error(json.error ?? 'Failed to save')
      }
    } catch {
      toast.error('Failed to save')
    } finally {
      setSavingEssl(false)
    }
  }

  useEffect(() => { fetchEmployee(); fetchEnrollments(); fetchDocuments() }, [fetchEmployee, fetchEnrollments, fetchDocuments])

  // ── end fetch ──

  const patch = async (payload: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        setEmployee(json.data)
        toast.success('Saved successfully')
        return true
      } else {
        toast.error(json.error || 'Save failed')
        return false
      }
    } catch {
      toast.error('Failed to save')
      return false
    } finally {
      setSaving(false)
    }
  }

  const savePersonal = async () => {
    const wasPlaceholder = employee?.email?.endsWith('@company.com')
    const newEmailIsReal = personalDraft.email && !personalDraft.email.endsWith('@company.com')

    // Merge the edited personal_info (today: just date_of_birth) into the
    // existing record so we don't overwrite anything the employee set from
    // their own portal (gender, blood group, addresses, emergency contact).
    // Only include personal_info in the patch if it actually changed —
    // sending it unconditionally would clobber the employee's portal edits
    // with the snapshot we took on mount.
    const draftDob = (personalDraft.personal_info as Record<string, unknown> | undefined)?.date_of_birth
    const currentDob = (employee?.personal_info as Record<string, unknown> | undefined)?.date_of_birth
    const personalInfoChanged = draftDob !== currentDob

    const ok = await patch({
      first_name: personalDraft.first_name,
      last_name:  personalDraft.last_name,
      phone:      personalDraft.phone,
      email:      personalDraft.email,
      ...(personalInfoChanged && {
        personal_info: {
          ...(employee?.personal_info ?? {}),
          date_of_birth: draftDob ?? null,
        },
      }),
    })
    if (!ok) return
    setEditPersonal(false)

    // Auto-send portal invite when a real email is set for the first time
    if (wasPlaceholder && newEmailIsReal) {
      // Small delay so the employee record is committed first
      setTimeout(() => sendPortalInvite(), 500)
    }
  }

  const saveEmployment = async () => {
    // UI shows monthly salary; store as annual (×12) in ctc_annual
    const monthly   = empDraft.ctc_annual       ? parseFloat(empDraft.ctc_annual)       : undefined
    const incentive = empDraft.monthly_incentive ? parseFloat(empDraft.monthly_incentive) : null
    const ok = await patch({
      emp_code: empDraft.emp_code?.trim() || undefined,
      department_id: empDraft.department_id || undefined,
      employment_type: empDraft.employment_type || undefined,
      designation_id: empDraft.designation_id || undefined,
      ctc_annual: monthly ? monthly * 12 : undefined,
      monthly_incentive: incentive,
      salary_structure_id: empDraft.salary_structure_id || undefined,
      date_of_joining: empDraft.date_of_joining || undefined,
    })
    if (ok) setEditEmployment(false)
  }

  const handleTransfer = async () => {
    const ok = await patch({ department_id: transferDept })
    if (ok) { setTransferModal(false); setTransferDept('') }
  }

  const handleDeactivate = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${employeeId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: terminationReason.trim() || undefined,
          last_working_day: lastWorkingDay || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Employee terminated and moved to archive')
        setDeactivateModal(false)
        router.push('/employees')
      } else {
        toast.error(json.error ?? 'Failed to terminate employee')
      }
    } catch {
      toast.error('Failed to terminate employee')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyId = () => {
    if (!employee) return
    navigator.clipboard.writeText(employee.emp_code)
    setCopiedId(true)
    toast.success('Copied!')
    setTimeout(() => setCopiedId(false), 2000)
  }

  if (loading) return (
    <AppLayout title="Employee Profile">
      <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    </AppLayout>
  )

  if (error || !employee) return (
    <AppLayout title="Employee Profile">
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error || 'Employee not found'}</p>
        <Button variant="outline" size="sm" onClick={fetchEmployee}>Retry</Button>
      </div>
    </AppLayout>
  )

  const fullName = `${employee.first_name} ${employee.last_name}`
  const initials = `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase()
  const statusVariant = statusColor[employee.status] ?? 'secondary'

  return (
    <AppLayout title="Employee Profile">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">{initials}</AvatarFallback>
              </Avatar>
              {employee.status === 'active' && (
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-kpi-green border-2 border-card" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
                <Badge variant={statusVariant} className="capitalize">{employee.status.replace('_', ' ')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{employee.designation?.name || 'No designation'}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{employee.department?.name || 'No dept'}</Badge>
                <Badge variant="outline" className="cursor-pointer" onClick={handleCopyId}>
                  {employee.emp_code} <Copy className="h-3 w-3 ml-1" />
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Joined {format(new Date(employee.date_of_joining), 'd MMM yyyy')}
                </span>
                <Badge variant="secondary">{employee.employment_type.replace('_', '-')}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Portal invite button — shown when email looks real */}
              {employee.status === 'active' && employee.email && !employee.email.endsWith('@company.com') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5"
                  onClick={sendPortalInvite}
                  disabled={sendingInvite}
                >
                  {sendingInvite
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />}
                  Send Portal Invite
                </Button>
              )}
              {employee.email?.endsWith('@company.com') && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 px-2 py-1 rounded-md flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Update real email to send invite
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => { setEditPersonal(true); setPersonalDraft(employee) }}>
                <Pencil className="h-4 w-4 mr-1.5" /> Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setTransferModal(true); setTransferDept(employee.department_id || '') }}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer Department
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={sendPortalInvite} disabled={sendingInvite || employee.email?.endsWith('@company.com')}>
                    <Send className="h-4 w-4 mr-2" /> {sendingInvite ? 'Sending…' : 'Resend Portal Invite'}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeactivateModal(true)}>
                    <UserX className="h-4 w-4 mr-2" /> Terminate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="w-full justify-start bg-card border h-auto p-1 flex-wrap">
          {[
            { value: 'personal', label: 'Personal Info' },
            { value: 'employment', label: 'Employment' },
            { value: 'attendance', label: 'Attendance' },
            { value: 'leave', label: 'Leave' },
            { value: 'payroll', label: 'Payroll' },
            { value: 'biometrics', label: 'Biometrics' },
            { value: 'documents', label: `Documents${documents.length > 0 ? ` (${documents.length})` : ''}` },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Personal Info ── */}
        <TabsContent value="personal" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
                {!editPersonal && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditPersonal(true); setPersonalDraft(employee) }}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editPersonal ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>First Name</Label>
                        <Input value={personalDraft.first_name || ''} onChange={e => setPersonalDraft(p => ({ ...p, first_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Last Name</Label>
                        <Input value={personalDraft.last_name || ''} onChange={e => setPersonalDraft(p => ({ ...p, last_name: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label className="flex items-center gap-1.5">
                          Work Email
                          {personalDraft.email?.endsWith('@company.com') && (
                            <span className="text-[10px] text-amber-600 font-normal">(placeholder — update to real email)</span>
                          )}
                        </Label>
                        <Input
                          type="email"
                          value={personalDraft.email || ''}
                          onChange={e => setPersonalDraft(p => ({ ...p, email: e.target.value }))}
                          placeholder="employee@example.com"
                          className={personalDraft.email?.endsWith('@company.com') ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-900/20' : ''}
                        />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label>Phone</Label>
                        <Input value={(personalDraft.phone as string) || ''} onChange={e => setPersonalDraft(p => ({ ...p, phone: e.target.value }))} />
                      </div>
                      {/* Date of Birth — drives the org-wide birthday panel
                          on the HR dashboard and the employee portal. Stored
                          in personal_info JSON, kept separate from the flat
                          Employee columns above. */}
                      <div className="space-y-1.5 col-span-2">
                        <Label>Date of Birth</Label>
                        <Input
                          type="date"
                          value={String((personalDraft.personal_info as Record<string, unknown> | undefined)?.date_of_birth ?? '')}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={e => setPersonalDraft(p => ({
                            ...p,
                            personal_info: {
                              ...(p.personal_info as Record<string, unknown> | undefined ?? {}),
                              date_of_birth: e.target.value,
                            },
                          }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Only the month and day are shown on the birthday panel — the year is never displayed to colleagues.
                        </p>
                      </div>
                    </div>
                    {/* Send invite hint when real email is being entered */}
                    {personalDraft.email && !personalDraft.email.endsWith('@company.com') &&
                      employee.email?.endsWith('@company.com') && (
                      <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary flex items-center gap-2">
                        <Send className="h-3.5 w-3.5 shrink-0" />
                        A portal invite will be sent automatically after saving.
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setEditPersonal(false)}>Cancel</Button>
                      <Button onClick={savePersonal} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      <InfoRow label="First Name" value={employee.first_name} />
                      <InfoRow label="Last Name" value={employee.last_name} />
                      <InfoRow label="Work Email" value={employee.email} />
                      <InfoRow label="Phone" value={employee.phone || '—'} />
                    </div>
                    <Separator className="my-2" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      {/* Dedicated Date of Birth row — formatted as a friendly
                          IN-locale date with computed age, instead of the
                          raw "1990-05-14" the generic personal_info loop
                          would show. We skip date_of_birth from the loop
                          below so it doesn't render twice. */}
                      {(() => {
                        const dob = (employee.personal_info as Record<string, unknown> | undefined)?.date_of_birth
                        if (!dob || typeof dob !== 'string') {
                          return <InfoRow label="Date of Birth" value="—" />
                        }
                        const d = new Date(dob)
                        if (isNaN(d.getTime())) {
                          return <InfoRow label="Date of Birth" value="—" />
                        }
                        // Age = floor((now − dob) / year), accounting for
                        // whether the birthday has occurred this year yet.
                        const now = new Date()
                        let age = now.getUTCFullYear() - d.getUTCFullYear()
                        const m = now.getUTCMonth() - d.getUTCMonth()
                        if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--
                        const formatted = d.toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'long', year: 'numeric',
                        })
                        return (
                          <InfoRow label="Date of Birth" value={`${formatted} (age ${age})`} />
                        )
                      })()}
                      {employee.personal_info && Object.entries(employee.personal_info)
                        .filter(([k]) => k !== 'date_of_birth')
                        .map(([k, v]) => (
                          <InfoRow key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                        ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Statutory */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Statutory Details</CardTitle></CardHeader>
                <CardContent>
                  {employee.statutory_info ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      {Object.entries(employee.statutory_info).map(([k, v]) => (
                        <InfoRow key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No statutory information on file.</p>
                  )}
                </CardContent>
              </Card>

              {/* Bank */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Bank Details</CardTitle></CardHeader>
                <CardContent>
                  {employee.bank_details ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      {Object.entries(employee.bank_details).map(([k, v]) => (
                        <InfoRow key={k} label={k.replace(/_/g, ' ')} value={String(v)}
                          badge={k === 'ifsc' ? <Badge variant="active" className="text-[10px] px-1.5 py-0"><ShieldCheck className="h-3 w-3 mr-0.5" /> Verified</Badge> : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No bank details on file.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Employment ── */}
        <TabsContent value="employment">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Employment Details</CardTitle>
              {!editEmployment && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setEditEmployment(true)
                  setEmpDraft({
                    emp_code: employee.emp_code || '',
                    department_id: employee.department_id || '',
                    employment_type: employee.employment_type,
                    designation_id: employee.designation_id || '',
                    // Pre-fill with monthly salary (annual ÷ 12) so the user sees/edits monthly
                    ctc_annual: employee.ctc_annual ? String(Math.round(Number(employee.ctc_annual) / 12)) : '',
                    monthly_incentive: employee.monthly_incentive ? String(Math.round(Number(employee.monthly_incentive))) : '',
                    salary_structure_id: employee.salary_structure_id || '',
                    date_of_joining: employee.date_of_joining ? employee.date_of_joining.split('T')[0] : '',
                  })
                }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {editEmployment ? (
                <div className="space-y-4 max-w-lg">
                  <div className="space-y-1.5">
                    <Label>Employee ID</Label>
                    <Input
                      value={empDraft.emp_code}
                      onChange={e => setEmpDraft(p => ({ ...p, emp_code: e.target.value }))}
                      placeholder="e.g. EMP0042"
                    />
                    {/* Warn HR before they change emp_code — it's the key
                        biometric devices and historical reports use. Editing
                        it doesn't migrate old punch logs or payslip filenames. */}
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      ⚠ Changing the Employee ID affects biometric device sync and
                      how historical attendance data is keyed. Update the device's
                      enrollment to match if you change this.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Department</Label>
                    <Select value={empDraft.department_id} onValueChange={v => setEmpDraft(p => ({ ...p, department_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Designation</Label>
                    <Select value={empDraft.designation_id} onValueChange={v => setEmpDraft(p => ({ ...p, designation_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                      <SelectContent>
                        {designations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Employment Type</Label>
                    <Select value={empDraft.employment_type} onValueChange={v => setEmpDraft(p => ({ ...p, employment_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monthly Salary (₹)</Label>
                    <Input
                      type="number"
                      value={empDraft.ctc_annual}
                      onChange={e => setEmpDraft(p => ({ ...p, ctc_annual: e.target.value }))}
                      placeholder="e.g. 22000"
                    />
                    {empDraft.ctc_annual && Number(empDraft.ctc_annual) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Annual CTC: ₹{(Number(empDraft.ctc_annual) * 12).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Monthly Incentive (₹)</Label>
                    <Input
                      type="number"
                      value={empDraft.monthly_incentive}
                      onChange={e => setEmpDraft(p => ({ ...p, monthly_incentive: e.target.value }))}
                      placeholder="e.g. 2000 (optional)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Added to gross every month automatically during payroll run.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Salary Structure</Label>
                    <Select value={empDraft.salary_structure_id} onValueChange={v => setEmpDraft(p => ({ ...p, salary_structure_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select structure" /></SelectTrigger>
                      <SelectContent>
                        {salaryStructures.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date of Joining</Label>
                    <Input
                      type="date"
                      value={empDraft.date_of_joining}
                      onChange={e => setEmpDraft(p => ({ ...p, date_of_joining: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setEditEmployment(false)}>Cancel</Button>
                    <Button onClick={saveEmployment} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
                  <InfoRow label="Department" value={employee.department?.name || '—'} />
                  <InfoRow label="Designation" value={employee.designation?.name || '—'} />
                  <InfoRow label="Employment Type" value={employee.employment_type.replace('_', ' ')} />
                  <InfoRow label="Date of Joining" value={format(new Date(employee.date_of_joining), 'd MMM yyyy')} />
                  <InfoRow label="Monthly Salary" value={employee.ctc_annual ? fmt(Math.round(Number(employee.ctc_annual) / 12)) : '—'} />
                  <InfoRow label="Monthly Incentive" value={employee.monthly_incentive && Number(employee.monthly_incentive) > 0 ? fmt(Math.round(Number(employee.monthly_incentive))) : '—'} />
                  <InfoRow label="Salary Structure" value={salaryStructures.find(s => s.id === employee.salary_structure_id)?.name || '—'} />
                  <InfoRow label="Status" value={employee.status.replace('_', ' ')} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Attendance ── */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Recent Attendance (last 30 records)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {employee.attendance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No attendance records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>In</TableHead>
                        <TableHead>Out</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.attendance.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{format(new Date(a.date), 'd MMM yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={a.status === 'present' ? 'active' : a.status === 'absent' ? 'terminated' : 'notice'} className="text-[10px] capitalize">
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {a.first_in ? format(new Date(a.first_in), 'HH:mm') : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {a.last_out ? format(new Date(a.last_out), 'HH:mm') : '—'}
                          </TableCell>
                          <TableCell className="text-right text-sm">{a.total_hours ? Number(a.total_hours).toFixed(1) + 'h' : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Leave ── */}
        <TabsContent value="leave" className="space-y-6">
          {/* Balance cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {leaveBalances.map(b => (
              <Card key={b.leave_type_id}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{b.name}</p>
                  <p className="text-2xl font-bold text-foreground">{b.available}</p>
                  <p className="text-xs text-muted-foreground">of {b.total} days</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Recent requests */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Recent Leave Requests</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {employee.leave_requests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No leave requests.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.leave_requests.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{r.leave_type.name}</TableCell>
                          <TableCell className="text-sm">{format(new Date(r.from_date), 'd MMM yyyy')}</TableCell>
                          <TableCell className="text-sm">{format(new Date(r.to_date), 'd MMM yyyy')}</TableCell>
                          <TableCell className="text-sm">{Number(r.total_days)}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'approved' ? 'active' : r.status === 'pending' ? 'notice' : 'terminated'} className="text-[10px] capitalize">
                              {r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payroll ── */}
        <TabsContent value="payroll">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Payslip History</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {employee.payslips.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No payslips available yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employee.payslips.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm font-medium">
                            {new Date(p.year, p.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="text-right text-sm">{fmt(Number(p.gross_salary))}</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-kpi-green">{fmt(Number(p.net_salary))}</TableCell>
                          <TableCell>
                            <Badge variant={p.is_published ? 'active' : 'notice'} className="text-[10px]">
                              {p.is_published ? 'Published' : 'Draft'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── Biometrics ── */}
        <TabsContent value="biometrics">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-primary" />
                Biometric Enrollment
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchEnrollments}
                  disabled={enrollmentsLoading}
                  className="h-8"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${enrollmentsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={syncToAllDevices}
                  disabled={syncAllLoading || enrollments.length === 0}
                  className="h-8"
                >
                  {syncAllLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    : <Fingerprint className="h-3.5 w-3.5 mr-1" />}
                  Sync to All Devices
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Device User ID mapping */}
              <div className="mb-5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-4">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-0.5">ESSL / ZKTeco Device User ID</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                  The numeric ID this employee is enrolled with on the physical device.
                  If blank, punches are matched by Employee Code (<code className="bg-amber-100 px-1 rounded">{employee?.emp_code}</code>).
                  Set this if the device user ID differs from the employee code.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={esslDeviceId}
                    onChange={(e) => setEsslDeviceId(e.target.value)}
                    placeholder={`Leave blank to use emp code (${employee?.emp_code})`}
                    className="flex-1 text-sm border border-amber-300 bg-background dark:bg-card rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700"
                    onClick={saveEsslDeviceId}
                    disabled={savingEssl}
                  >
                    {savingEssl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </div>

              {enrollmentsLoading && enrollments.length === 0 ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : enrollments.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground">No biometric devices configured.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add devices in Settings → Devices to enable biometric enrollment.
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Device</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enrollment</TableHead>
                        <TableHead>Last Synced</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments.map((d) => {
                        const isSyncing = syncingDevice === d.device_id
                        const enr = d.enrollment

                        let enrollBadge: React.ReactNode
                        if (!enr) {
                          enrollBadge = (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <XCircle className="h-3.5 w-3.5" /> Not synced
                            </span>
                          )
                        } else if (enr.status === 'enrolled') {
                          enrollBadge = (
                            <span className="flex items-center gap-1.5 text-xs text-kpi-green font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                            </span>
                          )
                        } else if (enr.status === 'pending') {
                          enrollBadge = (
                            <span className="flex items-center gap-1.5 text-xs text-kpi-amber font-medium">
                              <AlertCircle className="h-3.5 w-3.5" /> Pending — awaiting scan
                            </span>
                          )
                        } else {
                          enrollBadge = (
                            <span className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                              <XCircle className="h-3.5 w-3.5" /> Failed
                            </span>
                          )
                        }

                        const deviceDot =
                          d.device_status === 'online' ? 'bg-green-500'
                          : d.device_status === 'idle' ? 'bg-yellow-500'
                          : d.device_status === 'offline' ? 'bg-red-500'
                          : 'bg-gray-400 dark:bg-muted-foreground/50'

                        return (
                          <TableRow key={d.device_id}>
                            <TableCell className="font-medium text-sm">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${deviceDot}`} />
                                {d.device_name}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {d.device_location ?? '—'}
                            </TableCell>
                            <TableCell>
                              {d.device_status === 'online'
                                ? <span className="flex items-center gap-1 text-xs text-green-600"><Wifi className="h-3.5 w-3.5" /> Online</span>
                                : d.device_status === 'offline'
                                ? <span className="flex items-center gap-1 text-xs text-red-600"><WifiOff className="h-3.5 w-3.5" /> Offline</span>
                                : <span className="text-xs text-muted-foreground capitalize">{d.device_status.replace('_', ' ')}</span>
                              }
                            </TableCell>
                            <TableCell>{enrollBadge}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {enr?.synced_at
                                ? new Date(enr.synced_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={isSyncing || syncAllLoading}
                                onClick={() => syncToDevice(d.device_id)}
                              >
                                {isSyncing
                                  ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  : null}
                                {isSyncing ? 'Syncing…' : 'Sync to Device'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>

                  {/* Instructions card */}
                  <div className="mt-4 rounded-md bg-muted/50 border border-border p-4 text-sm">
                    <p className="font-medium mb-1.5">After syncing, ask the employee to:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                      <li>Walk to the biometric device</li>
                      <li>Select &quot;Enroll&quot; or &quot;Register Finger / Face&quot; on the device</li>
                      <li>Enter their Employee Code when prompted</li>
                      <li>Scan their fingerprint or face 3 times to complete enrollment</li>
                    </ol>
                    <p className="mt-2 text-xs text-muted-foreground">
                      ⓘ Biometric data (fingerprint / face) is stored on the device only — never in Axiotta HRMS.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" /> Employee Documents
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Documents uploaded by the employee. Verify each one after checking the original.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={fetchDocuments} disabled={docsLoading}>
                  {docsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(DOC_LABELS).map(([key, label]) => {
                    const doc = documents.find(d => d.type === key)
                    return (
                      <div key={key} className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${doc ? (doc.is_verified ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-border') : 'border-dashed border-muted-foreground/30'}`}>
                        {/* Status icon */}
                        <div className="shrink-0">
                          {doc?.is_verified
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            : doc
                            ? <AlertCircle className="h-4 w-4 text-amber-500" />
                            : <XCircle className="h-4 w-4 text-muted-foreground/40" />
                          }
                        </div>

                        {/* Label + filename */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          {doc ? (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{doc.file_name}</p>
                              {doc.notes && <p className="text-xs text-muted-foreground italic">"{doc.notes}"</p>}
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(doc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground/60">Not submitted</p>
                          )}
                        </div>

                        {/* Actions */}
                        {doc && (
                          <div className="flex items-center gap-2 shrink-0">
                            {doc.url && (
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                                  <ExternalLink className="h-3 w-3" /> View
                                </Button>
                              </a>
                            )}
                            <Button
                              variant={doc.is_verified ? 'outline' : 'default'}
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={verifyingDoc === doc.id}
                              onClick={() => handleVerifyDoc(doc.id, !doc.is_verified)}
                            >
                              {verifyingDoc === doc.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : doc.is_verified ? 'Unverify' : 'Verify'
                              }
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingDoc === doc.id}
                              onClick={() => handleDeleteDoc(doc.id)}
                            >
                              {deletingDoc === doc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '✕'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Summary */}
              {!docsLoading && (
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground border-t pt-3 flex-wrap">
                  <span className="text-emerald-600 font-medium">{documents.filter(d => d.is_verified).length} verified</span>
                  <span className="text-amber-600 font-medium">{documents.filter(d => !d.is_verified).length} uploaded, pending review</span>
                  <span className="text-muted-foreground/60">{Object.keys(DOC_LABELS).length - documents.length} not submitted</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Transfer Modal */}
      <Dialog open={transferModal} onOpenChange={setTransferModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Department</DialogTitle>
            <DialogDescription>Move {fullName} to a different department.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New Department</Label>
            <Select value={transferDept} onValueChange={setTransferDept}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferModal(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferDept || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate Modal */}
      <Dialog open={deactivateModal} onOpenChange={(o) => { setDeactivateModal(o); if (!o) { setTerminationReason(''); setLastWorkingDay('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <UserX className="h-4 w-4" /> Terminate Employee
            </DialogTitle>
            <DialogDescription>
              <strong>{fullName}</strong> will be moved to the Archive. Their attendance, payroll, and leave history is preserved but they will be removed from all active views.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Last Working Day</Label>
              <input
                type="date"
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
                className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reason for Termination <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                placeholder="e.g. Resigned, Contract ended, Performance…"
                rows={3}
                className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 text-xs text-destructive space-y-1">
              <p className="font-medium">This will also:</p>
              <ul className="list-disc list-inside space-y-0.5 text-destructive/80">
                <li>Remove from employee list, dashboard &amp; attendance</li>
                <li>Deactivate all biometric device enrollments</li>
                <li>Cancel any pending leave requests</li>
                <li>All historical data is preserved in Archive</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Terminate &amp; Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

export default EmployeeProfile
