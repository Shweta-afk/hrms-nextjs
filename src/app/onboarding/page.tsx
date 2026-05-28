'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, Loader2, Building2, Users, IndianRupee } from 'lucide-react'
import { toast } from 'sonner'

const STEPS = [
  { id: 1, label: 'Company', icon: Building2, title: 'Tell us about your company' },
  { id: 2, label: 'Employee', icon: Users, title: 'Add your first employee' },
  { id: 3, label: 'Payroll', icon: IndianRupee, title: 'Configure payroll settings' },
]

const INDUSTRIES = [
  'Technology', 'Finance & Banking', 'Healthcare', 'Education', 'Manufacturing',
  'Retail & E-commerce', 'Consulting', 'Media & Entertainment', 'Real Estate', 'Other',
]

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500+']

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [industry, setIndustry] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [hq, setHq] = useState('')

  // Step 2
  const [empFirstName, setEmpFirstName] = useState('')
  const [empLastName, setEmpLastName] = useState('')
  const [empEmail, setEmpEmail] = useState('')
  const [empCode, setEmpCode] = useState('')
  const [skipEmployee, setSkipEmployee] = useState(false)

  // Step 3
  const [payrollDay, setPayrollDay] = useState('28')
  const [pfEnabled, setPfEnabled] = useState(true)
  const [esiEnabled, setEsiEnabled] = useState(true)
  const [ptState, setPtState] = useState('maharashtra')

  async function handleNext() {
    if (step === 1) {
      // Save company info to org settings
      setSaving(true)
      try {
        await fetch('/api/settings/org', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ industry, company_size: companySize, headquarters: hq }),
        })
      } catch {
        // Non-critical — continue regardless
      } finally {
        setSaving(false)
      }
      setStep(2)
    } else if (step === 2) {
      if (!skipEmployee) {
        if (!empFirstName || !empEmail) {
          toast.error('First name and email are required')
          return
        }
        setSaving(true)
        try {
          const res = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              first_name: empFirstName,
              last_name: empLastName,
              email: empEmail,
              emp_code: empCode || undefined,
              employment_type: 'full_time',
            }),
          })
          const json = await res.json()
          if (!json.success) toast.error(json.error || 'Failed to add employee')
        } catch {
          toast.error('Failed to add employee')
        } finally {
          setSaving(false)
        }
      }
      setStep(3)
    } else {
      // Step 3 — save payroll config and finish
      setSaving(true)
      try {
        await fetch('/api/settings/org', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payroll_day: Number(payrollDay),
            pf_applicable: pfEnabled,
            esi_applicable: esiEnabled,
            pt_state: ptState,
          }),
        })
      } catch {
        // Non-critical
      } finally {
        setSaving(false)
      }
      toast.success('Setup complete! Welcome to your HRMS.')
      router.push('/dashboard')
    }
  }

  const progress = ((step - 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img src="/lightmodelogo.png" alt="Axiotta HRMS" className="h-10 w-auto object-contain mx-auto mb-2 dark:hidden" />
        <img src="/darkmodelogo.png" alt="Axiotta HRMS" className="h-10 w-auto object-contain mx-auto mb-2 hidden dark:block" />
        <p className="text-sm text-muted-foreground mt-1">Let's get your workspace ready</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              step === s.id
                ? 'bg-primary text-primary-foreground'
                : step > s.id
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}>
              {step > s.id
                ? <CheckCircle2 className="h-4 w-4" />
                : <s.icon className="h-4 w-4" />
              }
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 ${step > s.id ? 'bg-primary/40' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-lg mb-6 bg-muted rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>

      {/* Card */}
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{STEPS[step - 1].title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Step {step} of {STEPS.length}</p>
          </div>

          {/* Step 1 — Company */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger><SelectValue placeholder="Select your industry" /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Company Size</Label>
                <Select value={companySize} onValueChange={setCompanySize}>
                  <SelectTrigger><SelectValue placeholder="Number of employees" /></SelectTrigger>
                  <SelectContent>
                    {SIZES.map(s => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Headquarters City</Label>
                <Input
                  placeholder="e.g. Mumbai, Bangalore"
                  value={hq}
                  onChange={e => setHq(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 2 — First Employee */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="skip-emp"
                  checked={skipEmployee}
                  onCheckedChange={v => setSkipEmployee(!!v)}
                />
                <Label htmlFor="skip-emp" className="cursor-pointer font-normal text-sm">
                  Skip — I'll add employees later
                </Label>
              </div>
              {!skipEmployee && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>First Name *</Label>
                      <Input
                        placeholder="Rahul"
                        value={empFirstName}
                        onChange={e => setEmpFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last Name</Label>
                      <Input
                        placeholder="Sharma"
                        value={empLastName}
                        onChange={e => setEmpLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Work Email *</Label>
                    <Input
                      type="email"
                      placeholder="rahul@company.com"
                      value={empEmail}
                      onChange={e => setEmpEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Employee Code</Label>
                    <Input
                      placeholder="EMP0002 (auto-assigned if blank)"
                      value={empCode}
                      onChange={e => setEmpCode(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3 — Payroll */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Payroll Processing Day</Label>
                <Select value={payrollDay} onValueChange={setPayrollDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[25, 26, 27, 28, 29, 30, 31].map(d => (
                      <SelectItem key={d} value={String(d)}>Day {d} of each month</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Professional Tax State</Label>
                <Select value={ptState} onValueChange={setPtState}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['maharashtra', 'karnataka', 'west_bengal', 'gujarat', 'andhra_pradesh', 'telangana'].map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 pt-1">
                <Label>Statutory Deductions</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pf"
                    checked={pfEnabled}
                    onCheckedChange={v => setPfEnabled(!!v)}
                  />
                  <Label htmlFor="pf" className="cursor-pointer font-normal text-sm">
                    Provident Fund (PF) — 12% employee + 12% employer
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="esi"
                    checked={esiEnabled}
                    onCheckedChange={v => setEsiEnabled(!!v)}
                  />
                  <Label htmlFor="esi" className="cursor-pointer font-normal text-sm">
                    ESI — applicable for salary ≤ ₹21,000/month
                  </Label>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)} disabled={saving}>
                Back
              </Button>
            )}
            <Button className="flex-1" onClick={handleNext} disabled={saving}>
              {saving
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                : step === STEPS.length ? 'Finish Setup' : 'Continue'
              }
            </Button>
          </div>

          {step < STEPS.length && (
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip setup — go to dashboard
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
