'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Save, User } from 'lucide-react'
import { toast } from 'sonner'

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
}

export default function PortalProfilePage() {
  const { data: session } = useSession()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [phone, setPhone] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')

  async function fetchProfile() {
    setLoading(true)
    try {
      const res = await fetch('/api/employees?limit=1')
      const json = await res.json()
      if (json.success && json.data.employees.length > 0) {
        const emp = json.data.employees[0]
        setEmployee(emp)
        setPhone(emp.phone ?? '')
        setEmergencyContact(emp.personal_info?.emergency_contact ?? '')
        setEmergencyPhone(emp.personal_info?.emergency_phone ?? '')
      }
    } catch {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProfile() }, [])

  async function handleSave() {
    if (!employee) return
    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          personal_info: {
            ...employee.personal_info,
            emergency_contact: emergencyContact,
            emergency_phone: emergencyPhone,
          },
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Profile updated successfully')
        setEditing(false)
        fetchProfile()
      } else {
        toast.error('Failed to update profile')
      }
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Link href="/portal">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          </Link>
          <h1 className="text-lg font-bold">My Profile</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !employee ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            No employee record found. Contact HR.
          </div>
        ) : (
          <>
            {/* Profile Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xl font-bold text-primary">
                      {employee.first_name[0]}{employee.last_name[0]}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{employee.first_name} {employee.last_name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {employee.designation?.name ?? '—'} · {employee.department?.name ?? '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">{employee.emp_code}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employment Details — read only */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Employment Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Employee Code', employee.emp_code],
                  ['Email', employee.email],
                  ['Department', employee.department?.name ?? '—'],
                  ['Designation', employee.designation?.name ?? '—'],
                  ['Date of Joining', new Date(employee.date_of_joining).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
                  ['Employment Type', employee.employment_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Personal Info — editable */}
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Personal Information</CardTitle>
                {!editing ? (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Save</>}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Phone Number</Label>
                    {editing ? (
                      <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                    ) : (
                      <p className="text-sm font-medium">{phone || '—'}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Emergency Contact Name</Label>
                    {editing ? (
                      <Input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Contact name" />
                    ) : (
                      <p className="text-sm font-medium">{emergencyContact || '—'}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Emergency Contact Phone</Label>
                    {editing ? (
                      <Input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="+91 98765 43210" />
                    ) : (
                      <p className="text-sm font-medium">{emergencyPhone || '—'}</p>
                    )}
                  </div>
                </div>
                {!editing && (
                  <p className="text-xs text-muted-foreground">
                    To update bank details or statutory info, please contact HR directly.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}