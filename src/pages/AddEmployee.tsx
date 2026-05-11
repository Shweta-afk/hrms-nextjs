'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Check, ChevronLeft, ChevronRight, Upload, AlertCircle,
  User, Briefcase, Shield, FolderOpen, Loader2,
} from "lucide-react";
import { toast } from "sonner";

const steps = [
  { label: "Basic Info", icon: User },
  { label: "Employment", icon: Briefcase },
  { label: "Statutory & Bank", icon: Shield },
  { label: "Documents", icon: FolderOpen },
]

interface Department { id: string; name: string }
interface Employee { id: string; first_name: string; last_name: string; emp_code: string }

const AddEmployee = () => {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [managers, setManagers] = useState<Employee[]>([])

  // Step 1 — Basic Info
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [personalEmail, setPersonalEmail] = useState("")
  const [personalPhone, setPersonalPhone] = useState("")
  const [dob, setDob] = useState("")
  const [gender, setGender] = useState("")
  const [bloodGroup, setBloodGroup] = useState("")
  const [maritalStatus, setMaritalStatus] = useState("")
  const [address, setAddress] = useState("")
  const [emergencyName, setEmergencyName] = useState("")
  const [emergencyPhone, setEmergencyPhone] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 2 — Employment
  const [dateOfJoining, setDateOfJoining] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [designation, setDesignation] = useState("")
  const [managerId, setManagerId] = useState("")
  const [employmentType, setEmploymentType] = useState("")
  const [workLocation, setWorkLocation] = useState("")
  const [ctcAnnual, setCtcAnnual] = useState("")

  // Step 3 — Statutory & Bank
  const [pan, setPan] = useState("")
  const [aadhaar, setAadhaar] = useState("")
  const [uan, setUan] = useState("")
  const [esiNumber, setEsiNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [confirmAccount, setConfirmAccount] = useState("")
  const [ifsc, setIfsc] = useState("")
  const [accountType, setAccountType] = useState("")

  // Step 4 — Documents (names only, S3 upload later)
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({})

  const progress = ((currentStep + 1) / steps.length) * 100

  useEffect(() => {
    async function fetchData() {
      const [deptRes, empRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/employees?limit=100'),
      ])
      const [deptJson, empJson] = await Promise.all([deptRes.json(), empRes.json()])
      if (deptJson.success) setDepartments(deptJson.data)
      if (empJson.success) setManagers(empJson.data.employees)
    }
    fetchData()
  }, [])

  function validateStep1() {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = 'First name is required'
    if (!lastName.trim()) e.lastName = 'Last name is required'
    if (!personalEmail.trim()) e.personalEmail = 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) e.personalEmail = 'Invalid email'
    if (!personalPhone.trim()) e.personalPhone = 'Phone is required'
    if (!dob) e.dob = 'Date of birth is required'
    if (!gender) e.gender = 'Gender is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2() {
    const e: Record<string, string> = {}
    if (!dateOfJoining) e.dateOfJoining = 'Date of joining is required'
    if (!departmentId) e.departmentId = 'Department is required'
    if (!designation.trim()) e.designation = 'Designation is required'
    if (!employmentType) e.employmentType = 'Employment type is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep3() {
    const e: Record<string, string> = {}
    if (accountNumber && confirmAccount && accountNumber !== confirmAccount) {
      e.confirmAccount = 'Account numbers do not match'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (currentStep === 0 && !validateStep1()) return
    if (currentStep === 1 && !validateStep2()) return
    if (currentStep === 2 && !validateStep3()) return
    if (currentStep < steps.length - 1) setCurrentStep(s => s + 1)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        email: personalEmail,
        phone: personalPhone,
        date_of_joining: dateOfJoining,
        employment_type: employmentType,
        department_id: departmentId || undefined,
        designation_id: undefined,
        manager_id: managerId || undefined,
        essl_device_id: undefined,
        personal_info: {
          date_of_birth: dob,
          gender,
          blood_group: bloodGroup,
          marital_status: maritalStatus,
          address,
          emergency_contact: emergencyName,
          emergency_phone: emergencyPhone,
        },
        contact_info: {
          work_location: workLocation,
        },
        // Statutory — stored encrypted in real implementation
        statutory_info: pan || uan || esiNumber ? JSON.stringify({
          pan: pan.toUpperCase(),
          aadhaar_last4: aadhaar.slice(-4),
          uan,
          esi_number: esiNumber,
        }) : undefined,
        bank_details: bankName || accountNumber ? JSON.stringify({
          bank_name: bankName,
          account_number: accountNumber,
          ifsc: ifsc.toUpperCase(),
          account_type: accountType,
        }) : undefined,
        ctc_annual: ctcAnnual ? parseFloat(ctcAnnual) : undefined,
      }

      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (json.success) {
        toast.success(`Employee ${firstName} ${lastName} added successfully`)
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

  const field = (id: string, label: string, required = false, children: React.ReactNode) => (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {errors[id] && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> {errors[id]}
        </p>
      )}
    </div>
  )

  return (
    <AppLayout title="Add New Employee">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, i) => {
            const Icon = step.icon
            const isActive = i === currentStep
            const isCompleted = i < currentStep
            return (
              <div key={step.label} className="flex items-center flex-1 last:flex-0">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isCompleted ? 'bg-primary border-primary text-primary-foreground'
                    : isActive ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
                  }`}>
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-medium ${isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
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

        <Progress value={progress} className="h-1.5" />

        {/* STEP 1 — Basic Info */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
              <CardDescription>Enter the employee's personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {field('firstName', 'First Name', true,
                  <Input id="firstName" placeholder="Enter first name" value={firstName}
                    onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: '' })) }}
                    className={errors.firstName ? 'border-destructive' : firstName ? 'border-kpi-green' : ''}
                  />
                )}
                {field('lastName', 'Last Name', true,
                  <Input id="lastName" placeholder="Enter last name" value={lastName}
                    onChange={e => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: '' })) }}
                    className={errors.lastName ? 'border-destructive' : lastName ? 'border-kpi-green' : ''}
                  />
                )}
                {field('personalEmail', 'Personal Email', true,
                  <Input id="personalEmail" type="email" placeholder="name@example.com" value={personalEmail}
                    onChange={e => { setPersonalEmail(e.target.value); setErrors(p => ({ ...p, personalEmail: '' })) }}
                    className={errors.personalEmail ? 'border-destructive' : ''}
                  />
                )}
                {field('personalPhone', 'Personal Phone', true,
                  <Input id="personalPhone" type="tel" placeholder="+91 98765 43210" value={personalPhone}
                    onChange={e => { setPersonalPhone(e.target.value); setErrors(p => ({ ...p, personalPhone: '' })) }}
                    className={errors.personalPhone ? 'border-destructive' : ''}
                  />
                )}
                {field('dob', 'Date of Birth', true,
                  <Input id="dob" type="date" value={dob}
                    onChange={e => { setDob(e.target.value); setErrors(p => ({ ...p, dob: '' })) }}
                    className={errors.dob ? 'border-destructive' : ''}
                  />
                )}
                {field('gender', 'Gender', true,
                  <Select value={gender} onValueChange={v => { setGender(v); setErrors(p => ({ ...p, gender: '' })) }}>
                    <SelectTrigger className={errors.gender ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {field('bloodGroup', 'Blood Group', false,
                  <Select value={bloodGroup} onValueChange={setBloodGroup}>
                    <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                    <SelectContent>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field('maritalStatus', 'Marital Status', false,
                  <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Current Address</Label>
                <Textarea placeholder="Enter full address..." value={address}
                  onChange={e => setAddress(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Emergency Contact Name</Label>
                  <Input placeholder="Contact person name" value={emergencyName}
                    onChange={e => setEmergencyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Contact Phone</Label>
                  <Input type="tel" placeholder="+91 98765 43210" value={emergencyPhone}
                    onChange={e => setEmergencyPhone(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2 — Employment */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Employment Details</CardTitle>
              <CardDescription>Configure the employee's work information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Employee Code</Label>
                  <div className="flex items-center gap-2">
                    <Input disabled placeholder="Auto-generated" className="flex-1" />
                    <Badge variant="secondary" className="whitespace-nowrap text-xs">Auto-assigned</Badge>
                  </div>
                </div>

                {field('dateOfJoining', 'Date of Joining', true,
                  <Input type="date" value={dateOfJoining}
                    onChange={e => { setDateOfJoining(e.target.value); setErrors(p => ({ ...p, dateOfJoining: '' })) }}
                    className={errors.dateOfJoining ? 'border-destructive' : ''}
                  />
                )}

                {field('departmentId', 'Department', true,
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
                )}

                {field('designation', 'Designation', true,
                  <Input placeholder="e.g. Senior Software Engineer" value={designation}
                    onChange={e => { setDesignation(e.target.value); setErrors(p => ({ ...p, designation: '' })) }}
                    className={errors.designation ? 'border-destructive' : ''}
                  />
                )}

                <div className="space-y-2">
                  <Label>Reporting Manager</Label>
                  <Select value={managerId} onValueChange={setManagerId}>
                    <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent>
                      {managers.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.first_name} {m.last_name} ({m.emp_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {field('employmentType', 'Employment Type', true,
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
                )}

                <div className="space-y-2">
                  <Label>Work Location</Label>
                  <Input placeholder="e.g. Mumbai, Bengaluru" value={workLocation}
                    onChange={e => setWorkLocation(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Annual CTC (₹)</Label>
                  <Input type="number" placeholder="e.g. 600000" value={ctcAnnual}
                    onChange={e => setCtcAnnual(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used for payroll calculations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3 — Statutory & Bank */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statutory & Bank Details</CardTitle>
              <CardDescription>Tax, provident fund, and banking information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Statutory Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>PAN Number</Label>
                    <Input placeholder="ABCDE1234F" maxLength={10} value={pan}
                      onChange={e => setPan(e.target.value.toUpperCase())} className="uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label>Aadhaar Number</Label>
                    <Input placeholder="1234 5678 9012" maxLength={14} value={aadhaar}
                      onChange={e => setAadhaar(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Only last 4 digits will be stored</p>
                  </div>
                  <div className="space-y-2">
                    <Label>UAN Number</Label>
                    <Input placeholder="Universal Account Number" value={uan}
                      onChange={e => setUan(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>ESI Number</Label>
                    <Input placeholder="ESI contribution number" value={esiNumber}
                      onChange={e => setEsiNumber(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <h4 className="text-sm font-semibold text-foreground mb-3">Bank Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input placeholder="e.g. State Bank of India" value={bankName}
                      onChange={e => setBankName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input placeholder="Account number" type="password" value={accountNumber}
                      onChange={e => setAccountNumber(e.target.value)} />
                  </div>
                  {field('confirmAccount', 'Confirm Account Number', false,
                    <Input placeholder="Re-enter account number" value={confirmAccount}
                      onChange={e => { setConfirmAccount(e.target.value); setErrors(p => ({ ...p, confirmAccount: '' })) }}
                      className={errors.confirmAccount ? 'border-destructive' : ''}
                    />
                  )}
                  <div className="space-y-2">
                    <Label>IFSC Code</Label>
                    <Input placeholder="e.g. SBIN0001234" value={ifsc}
                      onChange={e => setIfsc(e.target.value.toUpperCase())} className="uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select value={accountType} onValueChange={setAccountType}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                        <SelectItem value="salary">Salary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4 — Documents */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documents</CardTitle>
              <CardDescription>
                Upload required employee documents. File upload to cloud will be enabled once S3 is configured.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { key: 'offer_letter', label: 'Offer Letter', required: true },
                  { key: 'id_proof', label: 'ID Proof (Aadhaar / Passport)', required: true },
                  { key: 'address_proof', label: 'Address Proof', required: false },
                  { key: 'education', label: 'Educational Certificates', required: true },
                  { key: 'prev_employment', label: 'Previous Employment Docs', required: false },
                  { key: 'photograph', label: 'Photograph', required: true },
                ].map(doc => (
                  <label
                    key={doc.key}
                    className="border-2 border-dashed border-border rounded-lg p-5 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadedDocs(prev => ({ ...prev, [doc.key]: file.name }))
                          toast.success(`${file.name} selected — will upload when S3 is configured`)
                        }
                      }}
                    />
                    <Upload className={`h-8 w-8 ${uploadedDocs[doc.key] ? 'text-kpi-green' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium text-foreground text-center">
                      {doc.label} {doc.required && <span className="text-destructive">*</span>}
                    </span>
                    {uploadedDocs[doc.key] ? (
                      <span className="text-xs text-kpi-green flex items-center gap-1">
                        <Check className="h-3 w-3" /> {uploadedDocs[doc.key]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">PDF, JPG, PNG up to 5MB</span>
                    )}
                  </label>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-medium text-foreground">Ready to add employee</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Clicking Submit will create the employee record in the database.
                  Documents will be stored once AWS S3 is configured.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={currentStep === 0 ? () => router.push('/employees') : () => setCurrentStep(s => s - 1)}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Button>

          <Button
            onClick={currentStep === steps.length - 1 ? handleSubmit : handleNext}
            disabled={submitting}
            className="gap-2"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Adding Employee...</>
            ) : currentStep === steps.length - 1 ? (
              <>Submit <Check className="h-4 w-4" /></>
            ) : (
              <>Save & Continue <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}

export default AddEmployee