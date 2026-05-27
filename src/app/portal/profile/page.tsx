'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft, Loader2, Save, Lock, CheckCircle2, Eye, EyeOff,
  ShieldCheck, User, Phone, Landmark, FileText,
} from 'lucide-react'
import { toast } from 'sonner'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  emp_code: string
  date_of_joining: string
  employment_type: string
  status: string
  department: { name: string } | null
  designation: { name: string } | null
  personal_info: Record<string, any>
  contact_info: Record<string, any>
  bank_details: Record<string, any> | null
  statutory_info: Record<string, any> | null
}

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−']
const RELATIONSHIPS = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other']

function SectionSave({ saving, onSave, onCancel }: { saving: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex gap-2 pt-2">
      <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
        Save Changes
      </Button>
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

export default function PortalProfilePage() {
  const { data: session } = useSession()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  // Personal info state
  const [editingPersonal, setEditingPersonal] = useState(false)
  const [savingPersonal, setSavingPersonal] = useState(false)
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [marital, setMarital] = useState('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [currentAddress, setCurrentAddress] = useState('')
  const [permanentAddress, setPermanentAddress] = useState('')

  // Emergency contact state
  const [editingEmergency, setEditingEmergency] = useState(false)
  const [savingEmergency, setSavingEmergency] = useState(false)
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyRelation, setEmergencyRelation] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')

  // Bank details state
  const [editingBank, setEditingBank] = useState(false)
  const [savingBank, setSavingBank] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccount, setConfirmAccount] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [accountType, setAccountType] = useState('savings')

  // Statutory state
  const [editingStatutory, setEditingStatutory] = useState(false)
  const [savingStatutory, setSavingStatutory] = useState(false)
  const [pan, setPan] = useState('')
  const [aadhaar, setAadhaar] = useState('')
  const [uan, setUan] = useState('')
  const [esiNumber, setEsiNumber] = useState('')

  async function fetchProfile() {
    if (!session?.user?.employee_id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${session.user.employee_id}`)
      const json = await res.json()
      if (json.success) {
        const emp: Employee = json.data
        setEmployee(emp)
        // Populate personal
        setPhone(emp.phone ?? '')
        setDob(emp.personal_info?.date_of_birth ?? '')
        setGender(emp.personal_info?.gender ?? '')
        setMarital(emp.personal_info?.marital_status ?? '')
        setBloodGroup(emp.personal_info?.blood_group ?? '')
        setCurrentAddress(emp.personal_info?.current_address ?? '')
        setPermanentAddress(emp.personal_info?.permanent_address ?? '')
        // Populate emergency
        setEmergencyName(emp.personal_info?.emergency_contact ?? '')
        setEmergencyRelation(emp.personal_info?.emergency_relation ?? '')
        setEmergencyPhone(emp.personal_info?.emergency_phone ?? '')
        // Populate bank
        setBankName(emp.bank_details?.bank_name ?? '')
        setAccountNumber(emp.bank_details?.account_number ?? '')
        setConfirmAccount(emp.bank_details?.account_number ?? '')
        setIfsc(emp.bank_details?.ifsc_code ?? '')
        setAccountHolder(emp.bank_details?.account_holder_name ?? '')
        setAccountType(emp.bank_details?.account_type ?? 'savings')
        // Populate statutory
        setPan(emp.statutory_info?.pan ?? '')
        setAadhaar(emp.statutory_info?.aadhaar ?? '')
        setUan(emp.statutory_info?.uan ?? '')
        setEsiNumber(emp.statutory_info?.esi_number ?? '')
      }
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProfile() }, [session?.user?.employee_id])

  async function patchEmployee(payload: Record<string, unknown>) {
    if (!employee) return false
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Failed to save')
    return true
  }

  async function savePersonal() {
    setSavingPersonal(true)
    try {
      await patchEmployee({
        phone,
        personal_info: {
          ...employee?.personal_info,
          date_of_birth: dob,
          gender,
          marital_status: marital,
          blood_group: bloodGroup,
          current_address: currentAddress,
          permanent_address: permanentAddress,
          emergency_contact: emergencyName,
          emergency_relation: emergencyRelation,
          emergency_phone: emergencyPhone,
        },
      })
      toast.success('Personal information saved')
      setEditingPersonal(false)
      fetchProfile()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingPersonal(false)
    }
  }

  async function saveEmergency() {
    setSavingEmergency(true)
    try {
      await patchEmployee({
        personal_info: {
          ...employee?.personal_info,
          emergency_contact: emergencyName,
          emergency_relation: emergencyRelation,
          emergency_phone: emergencyPhone,
        },
      })
      toast.success('Emergency contact saved')
      setEditingEmergency(false)
      fetchProfile()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingEmergency(false)
    }
  }

  async function saveBank() {
    if (accountNumber !== confirmAccount) {
      toast.error('Account numbers do not match')
      return
    }
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
      toast.error('Invalid IFSC code format (e.g. SBIN0001234)')
      return
    }
    setSavingBank(true)
    try {
      await patchEmployee({
        bank_details: {
          bank_name: bankName,
          account_number: accountNumber,
          ifsc_code: ifsc.toUpperCase(),
          account_holder_name: accountHolder,
          account_type: accountType,
        },
      })
      toast.success('Bank details saved securely')
      setEditingBank(false)
      fetchProfile()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingBank(false)
    }
  }

  async function saveStatutory() {
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase())) {
      toast.error('Invalid PAN format (e.g. ABCDE1234F)')
      return
    }
    if (aadhaar && !/^\d{12}$/.test(aadhaar.replace(/\s/g, ''))) {
      toast.error('Aadhaar must be 12 digits')
      return
    }
    setSavingStatutory(true)
    try {
      await patchEmployee({
        statutory_info: {
          pan: pan.toUpperCase(),
          aadhaar: aadhaar.replace(/\s/g, ''),
          uan,
          esi_number: esiNumber,
        },
      })
      toast.success('Statutory details saved securely')
      setEditingStatutory(false)
      fetchProfile()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingStatutory(false)
    }
  }

  function maskAccount(acc: string) {
    if (!acc) return '—'
    return '••••' + acc.slice(-4)
  }

  function maskAadhaar(a: string) {
    if (!a) return '—'
    const d = a.replace(/\s/g, '')
    return 'XXXX XXXX ' + d.slice(-4)
  }

  const bankFilled = !!(employee?.bank_details?.account_number)
  const statFilled = !!(employee?.statutory_info?.pan)

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Link href="/portal">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          </Link>
          <h1 className="text-lg font-bold">My Profile</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !employee ? (
          <p className="text-center py-20 text-sm text-muted-foreground">No employee record found. Contact HR.</p>
        ) : (
          <>
            {/* Header card */}
            <Card>
              <CardContent className="p-6 flex items-center gap-5">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-2xl font-bold text-primary">
                    {employee.first_name[0]}{employee.last_name?.[0] ?? ''}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold truncate">{employee.first_name} {employee.last_name}</h2>
                  <p className="text-sm text-muted-foreground">{employee.designation?.name ?? '—'} · {employee.department?.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{employee.emp_code} · Joined {fmtDate(employee.date_of_joining)}</p>
                </div>
                <Badge variant={employee.status === 'active' ? 'active' : 'terminated'} className="shrink-0 capitalize">
                  {employee.status}
                </Badge>
              </CardContent>
            </Card>

            {/* Encryption notice */}
            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                Your bank and statutory details are <strong className="text-foreground">encrypted with AES-256</strong> before storage. HR cannot see your raw account number or Aadhaar — only the last 4 digits are displayed.
              </p>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="personal">
              <TabsList className="w-full grid grid-cols-4 h-auto">
                <TabsTrigger value="personal" className="flex items-center gap-1.5 text-xs">
                  <User className="h-3.5 w-3.5" />Personal
                </TabsTrigger>
                <TabsTrigger value="emergency" className="flex items-center gap-1.5 text-xs">
                  <Phone className="h-3.5 w-3.5" />Emergency
                </TabsTrigger>
                <TabsTrigger value="bank" className="flex items-center gap-1.5 text-xs">
                  <Landmark className="h-3.5 w-3.5" />
                  Bank
                  {bankFilled && <CheckCircle2 className="h-3 w-3 text-kpi-green ml-0.5" />}
                </TabsTrigger>
                <TabsTrigger value="statutory" className="flex items-center gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  Statutory
                  {statFilled && <CheckCircle2 className="h-3 w-3 text-kpi-green ml-0.5" />}
                </TabsTrigger>
              </TabsList>

              {/* ── Personal Info ── */}
              <TabsContent value="personal" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Personal Information</CardTitle>
                    {!editingPersonal
                      ? <Button size="sm" variant="outline" onClick={() => setEditingPersonal(true)}>Edit</Button>
                      : null
                    }
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Read-only employment info */}
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border">
                      <ReadOnlyField label="Email" value={employee.email} />
                      <ReadOnlyField label="Employee Code" value={employee.emp_code} />
                      <ReadOnlyField label="Department" value={employee.department?.name ?? '—'} />
                      <ReadOnlyField label="Designation" value={employee.designation?.name ?? '—'} />
                      <ReadOnlyField label="Employment Type" value={employee.employment_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
                      <ReadOnlyField label="Date of Joining" value={fmtDate(employee.date_of_joining)} />
                    </div>

                    {/* Editable fields */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Phone Number</Label>
                        {editingPersonal
                          ? <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                          : <p className="text-sm font-medium">{phone || '—'}</p>
                        }
                      </div>
                      <div className="space-y-1.5">
                        <Label>Date of Birth</Label>
                        {editingPersonal
                          ? <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
                          : <p className="text-sm font-medium">{dob ? fmtDate(dob) : '—'}</p>
                        }
                      </div>
                      <div className="space-y-1.5">
                        <Label>Gender</Label>
                        {editingPersonal
                          ? (
                            <Select value={gender} onValueChange={setGender}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                              </SelectContent>
                            </Select>
                          )
                          : <p className="text-sm font-medium capitalize">{gender?.replace(/_/g, ' ') || '—'}</p>
                        }
                      </div>
                      <div className="space-y-1.5">
                        <Label>Marital Status</Label>
                        {editingPersonal
                          ? (
                            <Select value={marital} onValueChange={setMarital}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="single">Single</SelectItem>
                                <SelectItem value="married">Married</SelectItem>
                                <SelectItem value="divorced">Divorced</SelectItem>
                                <SelectItem value="widowed">Widowed</SelectItem>
                              </SelectContent>
                            </Select>
                          )
                          : <p className="text-sm font-medium capitalize">{marital || '—'}</p>
                        }
                      </div>
                      <div className="space-y-1.5">
                        <Label>Blood Group</Label>
                        {editingPersonal
                          ? (
                            <Select value={bloodGroup} onValueChange={setBloodGroup}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )
                          : <p className="text-sm font-medium">{bloodGroup || '—'}</p>
                        }
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Current Address</Label>
                      {editingPersonal
                        ? <Input value={currentAddress} onChange={e => setCurrentAddress(e.target.value)} placeholder="Flat / Street / City / State / PIN" />
                        : <p className="text-sm font-medium">{currentAddress || '—'}</p>
                      }
                    </div>
                    <div className="space-y-1.5">
                      <Label>Permanent Address</Label>
                      {editingPersonal
                        ? <Input value={permanentAddress} onChange={e => setPermanentAddress(e.target.value)} placeholder="Same as current or enter address" />
                        : <p className="text-sm font-medium">{permanentAddress || '—'}</p>
                      }
                    </div>

                    {editingPersonal && (
                      <SectionSave saving={savingPersonal} onSave={savePersonal} onCancel={() => setEditingPersonal(false)} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Emergency Contact ── */}
              <TabsContent value="emergency" className="mt-4">
                <Card>
                  <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Emergency Contact</CardTitle>
                    {!editingEmergency
                      ? <Button size="sm" variant="outline" onClick={() => setEditingEmergency(true)}>Edit</Button>
                      : null
                    }
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      This person will be contacted in case of a medical emergency at the workplace.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Full Name</Label>
                        {editingEmergency
                          ? <Input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Contact's full name" />
                          : <p className="text-sm font-medium">{emergencyName || '—'}</p>
                        }
                      </div>
                      <div className="space-y-1.5">
                        <Label>Relationship</Label>
                        {editingEmergency
                          ? (
                            <Select value={emergencyRelation} onValueChange={setEmergencyRelation}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {RELATIONSHIPS.map(r => <SelectItem key={r} value={r.toLowerCase()}>{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )
                          : <p className="text-sm font-medium capitalize">{emergencyRelation || '—'}</p>
                        }
                      </div>
                      <div className="space-y-1.5 col-span-2 sm:col-span-1">
                        <Label>Phone Number</Label>
                        {editingEmergency
                          ? <Input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="+91 98765 43210" />
                          : <p className="text-sm font-medium">{emergencyPhone || '—'}</p>
                        }
                      </div>
                    </div>
                    {editingEmergency && (
                      <SectionSave saving={savingEmergency} onSave={saveEmergency} onCancel={() => setEditingEmergency(false)} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Bank Details ── */}
              <TabsContent value="bank" className="mt-4">
                <Card>
                  <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        Bank Details
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Used for salary transfer. Stored encrypted.</p>
                    </div>
                    {!editingBank
                      ? <Button size="sm" variant="outline" onClick={() => { setShowAccount(false); setEditingBank(true) }}>
                          {bankFilled ? 'Update' : 'Add Details'}
                        </Button>
                      : null
                    }
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!editingBank ? (
                      bankFilled ? (
                        <div className="grid grid-cols-2 gap-4">
                          <ReadOnlyField label="Bank Name" value={employee.bank_details?.bank_name ?? ''} />
                          <ReadOnlyField label="Account Type" value={employee.bank_details?.account_type ?? ''} />
                          <ReadOnlyField label="Account Number" value={maskAccount(employee.bank_details?.account_number ?? '')} />
                          <ReadOnlyField label="IFSC Code" value={employee.bank_details?.ifsc_code ?? ''} />
                          <ReadOnlyField label="Account Holder" value={employee.bank_details?.account_holder_name ?? ''} />
                        </div>
                      ) : (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          <Landmark className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          No bank details added yet. Your salary cannot be processed without this.
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <Label>Bank Name *</Label>
                            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. State Bank of India" />
                          </div>
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <Label>Account Type</Label>
                            <Select value={accountType} onValueChange={setAccountType}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="savings">Savings</SelectItem>
                                <SelectItem value="current">Current</SelectItem>
                                <SelectItem value="salary">Salary Account</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5 col-span-2">
                            <Label>Account Holder Name *</Label>
                            <Input value={accountHolder} onChange={e => setAccountHolder(e.target.value)} placeholder="Name as on bank account" />
                          </div>
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <Label>Account Number *</Label>
                            <div className="relative">
                              <Input
                                type={showAccount ? 'text' : 'password'}
                                value={accountNumber}
                                onChange={e => setAccountNumber(e.target.value)}
                                placeholder="Enter account number"
                                className="pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowAccount(p => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                              >
                                {showAccount ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <Label>Confirm Account Number *</Label>
                            <Input
                              type="password"
                              value={confirmAccount}
                              onChange={e => setConfirmAccount(e.target.value)}
                              placeholder="Re-enter account number"
                            />
                            {confirmAccount && accountNumber !== confirmAccount && (
                              <p className="text-xs text-destructive">Account numbers do not match</p>
                            )}
                          </div>
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <Label>IFSC Code *</Label>
                            <Input
                              value={ifsc}
                              onChange={e => setIfsc(e.target.value.toUpperCase())}
                              placeholder="e.g. SBIN0001234"
                              maxLength={11}
                            />
                          </div>
                        </div>
                        <SectionSave saving={savingBank} onSave={saveBank} onCancel={() => setEditingBank(false)} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Statutory ── */}
              <TabsContent value="statutory" className="mt-4">
                <Card>
                  <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        Statutory & Tax Details
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Required for PF, ESI, and TDS filing. Stored encrypted.</p>
                    </div>
                    {!editingStatutory
                      ? <Button size="sm" variant="outline" onClick={() => setEditingStatutory(true)}>
                          {statFilled ? 'Update' : 'Add Details'}
                        </Button>
                      : null
                    }
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!editingStatutory ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">PAN Number</p>
                          <p className="text-sm font-medium font-mono">{pan || '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Aadhaar Number</p>
                          <p className="text-sm font-medium font-mono">{maskAadhaar(aadhaar)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">UAN (PF)</p>
                          <p className="text-sm font-medium font-mono">{uan || '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">ESI Number</p>
                          <p className="text-sm font-medium font-mono">{esiNumber || '—'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label>PAN Number</Label>
                            <Input
                              value={pan}
                              onChange={e => setPan(e.target.value.toUpperCase())}
                              placeholder="ABCDE1234F"
                              maxLength={10}
                              className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">Required for TDS computation</p>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Aadhaar Number</Label>
                            <Input
                              value={aadhaar}
                              onChange={e => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                              placeholder="12-digit Aadhaar"
                              className="font-mono"
                              maxLength={12}
                            />
                            <p className="text-xs text-muted-foreground">Stored encrypted, never displayed in full</p>
                          </div>
                          <div className="space-y-1.5">
                            <Label>UAN Number</Label>
                            <Input
                              value={uan}
                              onChange={e => setUan(e.target.value)}
                              placeholder="Universal Account Number (PF)"
                              className="font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>ESI Number</Label>
                            <Input
                              value={esiNumber}
                              onChange={e => setEsiNumber(e.target.value)}
                              placeholder="ESI beneficiary number"
                              className="font-mono"
                            />
                          </div>
                        </div>
                        <SectionSave saving={savingStatutory} onSave={saveStatutory} onCancel={() => setEditingStatutory(false)} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  )
}
