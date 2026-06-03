'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check, ChevronLeft, ChevronRight, Loader2, AlertCircle,
  User, ClipboardList, Mail,
} from "lucide-react";
import { toast } from "sonner";

const steps = [
  { label: "Employee Details", icon: User },
  { label: "Review & Invite",  icon: Mail },
]

interface Department { id: string; name: string }
interface Employee   { id: string; first_name: string; last_name: string; emp_code: string }

// ── Field wrapper — defined OUTSIDE AddEmployee so it's a stable component
// reference. Defining it inside the parent causes React to unmount/remount
// on every keystroke (new function reference = new component type = focus lost).
function Field({
  id, label, required, errors, children,
}: {
  id: string
  label: string
  required?: boolean
  errors: Record<string, string>
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {errors[id] && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />{errors[id]}
        </p>
      )}
    </div>
  )
}

const AddEmployee = () => {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting]   = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers]       = useState<Employee[]>([])
  const [errors, setErrors]           = useState<Record<string, string>>({})

  // ── Form fields ──────────────────────────────────────────────────────────
  const [firstName,      setFirstName]      = useState("")
  const [lastName,       setLastName]       = useState("")
  const [email,          setEmail]          = useState("")
  const [phone,          setPhone]          = useState("")
  const [empCode,        setEmpCode]        = useState("")
  const [dateOfJoining,  setDateOfJoining]  = useState("")
  const [departmentId,   setDepartmentId]   = useState("")
  const [designation,    setDesignation]    = useState("")
  const [managerId,      setManagerId]      = useState("")
  const [employmentType, setEmploymentType] = useState("")
  const [esslDeviceId,   setEsslDeviceId]   = useState("")
  const [ctcAnnual,      setCtcAnnual]      = useState("")

  useEffect(() => {
    Promise.all([
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/employees?limit=200').then(r => r.json()),
    ]).then(([deptJson, empJson]) => {
      if (deptJson.success) setDepartments(deptJson.data)
      if (empJson.success)  setManagers(empJson.data.employees)
    })
  }, [])

  function validate() {
    const e: Record<string, string> = {}
    if (!firstName.trim())     e.firstName      = 'First name is required'
    if (!lastName.trim())      e.lastName       = 'Last name is required'
    if (!email.trim())         e.email          = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email address'
    if (!dateOfJoining)        e.dateOfJoining  = 'Date of joining is required'
    if (!departmentId)         e.departmentId   = 'Department is required'
    if (!designation.trim())   e.designation    = 'Designation is required'
    if (!employmentType)       e.employmentType = 'Employment type is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (!validate()) return
    setCurrentStep(1)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        first_name:      firstName,
        last_name:       lastName,
        email,
        phone:           phone || undefined,
        emp_code:        empCode.trim() || undefined,
        date_of_joining: dateOfJoining,
        employment_type: employmentType,
        department_id:   departmentId || undefined,
        manager_id:      managerId    || undefined,
        essl_device_id:  esslDeviceId || undefined,
        ctc_annual:      ctcAnnual ? parseFloat(ctcAnnual) : undefined,
      }
      // designation is a free-text field; map it as a name-based lookup or store in notes
      // The API accepts designation_id; we'll pass it as text via a separate field if needed
      // For now pass designation as a temp note until designations endpoint is wired
      if (designation) payload.designation_id = undefined   // keep slot; HR can link later

      const res  = await fetch('/api/employees', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()

      if (json.success) {
        toast.success(`${firstName} ${lastName} added — welcome email sent!`)
        router.push('/employees')
      } else {
        toast.error(typeof json.error === 'string' ? json.error : 'Failed to add employee')
      }
    } catch {
      toast.error('Failed to add employee')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const deptName    = departments.find(d => d.id === departmentId)?.name ?? '—'
  const managerName = managers.find(m => m.id === managerId)
  const managerLabel = managerName
    ? `${managerName.first_name} ${managerName.last_name} (${managerName.emp_code})`
    : '—'

  const emp_type_label: Record<string, string> = {
    full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', intern: 'Intern',
  }

  return (
    <AppLayout title="Add New Employee">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Step indicator */}
        <div className="flex items-center justify-between">
          {steps.map((step, i) => {
            const Icon = step.icon
            const done   = i < currentStep
            const active = i === currentStep
            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    done   ? 'bg-primary border-primary text-primary-foreground'
                    : active ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
                  }`}>
                    {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 mt-[-1.25rem] ${i < currentStep ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── STEP 1 — Employee Details ─────────────────────────────────────── */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Employee Details</CardTitle>
              <CardDescription>
                Fill in the basics. A welcome email with login credentials will be sent automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <Field id="firstName" label="First Name" required errors={errors}>
                  <Input id="firstName" placeholder="Rahul" value={firstName}
                    onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: '' })) }}
                    className={errors.firstName ? 'border-destructive' : firstName ? 'border-green-500' : ''}
                  />
                </Field>

                <Field id="lastName" label="Last Name" required errors={errors}>
                  <Input id="lastName" placeholder="Sharma" value={lastName}
                    onChange={e => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: '' })) }}
                    className={errors.lastName ? 'border-destructive' : lastName ? 'border-green-500' : ''}
                  />
                </Field>

                <Field id="email" label="Work / Personal Email" required errors={errors}>
                  <Input id="email" type="email" placeholder="rahul@company.com" value={email}
                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  <p className="text-xs text-muted-foreground">Used for login and welcome email</p>
                </Field>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="+91 98765 43210" value={phone}
                    onChange={e => setPhone(e.target.value)} />
                </div>

                <Field id="empCode" label="Employee Code" errors={errors}>
                  <Input id="empCode" placeholder="e.g. EMP0042 (auto if blank)" value={empCode}
                    onChange={e => setEmpCode(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Leave blank to auto-generate</p>
                </Field>

                <Field id="dateOfJoining" label="Date of Joining" required errors={errors}>
                  <Input id="dateOfJoining" type="date" value={dateOfJoining}
                    onChange={e => { setDateOfJoining(e.target.value); setErrors(p => ({ ...p, dateOfJoining: '' })) }}
                    className={errors.dateOfJoining ? 'border-destructive' : ''}
                  />
                </Field>

                <Field id="departmentId" label="Department" required errors={errors}>
                  <Select value={departmentId} onValueChange={v => { setDepartmentId(v); setErrors(p => ({ ...p, departmentId: '' })) }}>
                    <SelectTrigger className={errors.departmentId ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field id="designation" label="Designation" required errors={errors}>
                  <Input id="designation" placeholder="e.g. Software Engineer" value={designation}
                    onChange={e => { setDesignation(e.target.value); setErrors(p => ({ ...p, designation: '' })) }}
                    className={errors.designation ? 'border-destructive' : ''}
                  />
                </Field>

                <Field id="employmentType" label="Employment Type" required errors={errors}>
                  <Select value={employmentType} onValueChange={v => { setEmploymentType(v); setErrors(p => ({ ...p, employmentType: '' })) }}>
                    <SelectTrigger className={errors.employmentType ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full-time</SelectItem>
                      <SelectItem value="part_time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <div className="space-y-2">
                  <Label>Reporting Manager</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger><SelectValue placeholder="None / select manager" /></SelectTrigger>
                    <SelectContent>
                      {managers.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.first_name} {m.last_name} ({m.emp_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Field id="esslDeviceId" label="Biometric Device ID" errors={errors}>
                  <Input id="esslDeviceId" placeholder="e.g. 25" value={esslDeviceId}
                    onChange={e => setEsslDeviceId(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Employee's ID on the ZKTeco / AiFace device</p>
                </Field>

                <div className="space-y-2">
                  <Label htmlFor="ctcAnnual">Annual CTC (₹)</Label>
                  <Input id="ctcAnnual" type="number" placeholder="e.g. 600000" value={ctcAnnual}
                    onChange={e => setCtcAnnual(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used for payroll calculations</p>
                </div>

              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 2 — Review & Invite ──────────────────────────────────────── */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Review & Send Invite</CardTitle>
              <CardDescription>
                Confirm the details below. A welcome email with temporary login credentials will be sent to the employee.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              <div className="rounded-lg border border-border divide-y divide-border">
                {[
                  ['Full Name',        `${firstName} ${lastName}`],
                  ['Email',            email],
                  ['Phone',            phone || '—'],
                  ['Employee Code',    empCode.trim() || 'Auto-generated'],
                  ['Date of Joining',  dateOfJoining
                    ? new Date(dateOfJoining).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
                    : '—'],
                  ['Department',       deptName],
                  ['Designation',      designation],
                  ['Employment Type',  emp_type_label[employmentType] ?? employmentType],
                  ['Manager',          managerLabel],
                  ['Device ID',        esslDeviceId || '—'],
                  ['Annual CTC',       ctcAnnual ? `₹ ${Number(ctcAnnual).toLocaleString('en-IN')}` : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground w-36 flex-shrink-0">{label}</span>
                    <span className="font-medium text-right">{value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Welcome email will be sent</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                    A temporary password will be emailed to <strong>{email}</strong>. The employee can log in and complete their profile (PAN, bank details, documents, etc.).
                  </p>
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant={"outline" as any}
            onClick={currentStep === 0 ? () => router.push('/employees') : () => setCurrentStep(0)}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep === 0 ? (
            <Button onClick={handleNext} className="gap-2">
              Review & Continue <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Adding Employee...</>
              ) : (
                <><Check className="h-4 w-4" />Add Employee & Send Invite</>
              )}
            </Button>
          )}
        </div>

      </div>
    </AppLayout>
  )
}

export default AddEmployee
