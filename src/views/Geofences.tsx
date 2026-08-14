'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { MapPin, Plus, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'

interface Geofence {
  id: string
  name: string
  address: string | null
  latitude: string
  longitude: string
  radius_m: number
  is_active: boolean
  assigned_employee_count: number
}

interface AssignableEmployee {
  employee_id: string
  emp_code: string
  name: string
  department: string | null
  assigned: boolean
}

const emptyForm = { name: '', address: '', latitude: '', longitude: '', radius_m: '200' }

export default function Geofences() {
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [assignTarget, setAssignTarget] = useState<Geofence | null>(null)
  const [assignable, setAssignable] = useState<AssignableEmployee[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const fetchGeofences = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/geofences')
      const json = await res.json()
      if (json.success) setGeofences(json.data)
      else toast.error(json.error ?? 'Failed to load sites')
    } catch {
      toast.error('Failed to load sites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGeofences() }, [fetchGeofences])

  async function handleCreate() {
    if (!form.name || !form.latitude || !form.longitude) {
      toast.error('Name, latitude and longitude are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          address: form.address || undefined,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          radius_m: parseInt(form.radius_m) || 200,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Site "${form.name}" created`)
        setCreateOpen(false)
        setForm(emptyForm)
        fetchGeofences()
      } else {
        toast.error(json.error ?? 'Failed to create site')
      }
    } catch {
      toast.error('Failed to create site')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(g: Geofence) {
    try {
      const res = await fetch(`/api/geofences/${g.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !g.is_active }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(g.is_active ? `${g.name} deactivated` : `${g.name} activated`)
        fetchGeofences()
      } else {
        toast.error(json.error ?? 'Failed to update site')
      }
    } catch {
      toast.error('Failed to update site')
    }
  }

  async function openAssign(g: Geofence) {
    setAssignTarget(g)
    setAssignLoading(true)
    try {
      const res = await fetch(`/api/geofences/${g.id}/employees`)
      const json = await res.json()
      if (json.success) setAssignable(json.data)
      else toast.error(json.error ?? 'Failed to load employees')
    } catch {
      toast.error('Failed to load employees')
    } finally {
      setAssignLoading(false)
    }
  }

  async function toggleAssignment(emp: AssignableEmployee) {
    if (!assignTarget) return
    setAssigning(true)
    try {
      if (emp.assigned) {
        const res = await fetch(`/api/geofences/${assignTarget.id}/employees?employee_id=${emp.employee_id}`, {
          method: 'DELETE',
        })
        const json = await res.json()
        if (!json.success) { toast.error(json.error ?? 'Failed to unassign'); return }
      } else {
        const res = await fetch(`/api/geofences/${assignTarget.id}/employees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_ids: [emp.employee_id] }),
        })
        const json = await res.json()
        if (!json.success) { toast.error(json.error ?? 'Failed to assign'); return }
      }
      setAssignable(prev => prev.map(e => e.employee_id === emp.employee_id ? { ...e, assigned: !e.assigned } : e))
      fetchGeofences()
    } catch {
      toast.error('Failed to update assignment')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <AppLayout title="Field Agent Sites">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Field Agent Sites
          </h1>
          <p className="text-sm text-muted-foreground">
            Geofenced locations field agents can punch in/out from. Also see{' '}
            <Link href="/attendance/field-map" className="text-primary hover:underline">
              the field map view
            </Link>.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Site
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sites</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : geofences.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No sites yet. Add one so field agents can be assigned to it.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Address</TableHead>
                  <TableHead>Radius</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {geofences.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">
                      {g.name}
                      <div className="text-xs text-muted-foreground">
                        {Number(g.latitude).toFixed(6)}, {Number(g.longitude).toFixed(6)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {g.address ?? '—'}
                    </TableCell>
                    <TableCell>{g.radius_m}m</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{g.assigned_employee_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={g.is_active} onCheckedChange={() => handleToggleActive(g)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openAssign(g)}>
                        <Users className="h-3.5 w-3.5" /> Assign
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create site dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Field Site</DialogTitle>
            <DialogDescription>
              Field agents assigned to this site can only punch in/out within its radius.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Client X Warehouse" />
            </div>
            <div>
              <Label>Address (optional)</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))} placeholder="19.076090" />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))} placeholder="72.877426" />
              </div>
            </div>
            <div>
              <Label>Radius (meters)</Label>
              <Input type="number" value={form.radius_m} onChange={e => setForm(p => ({ ...p, radius_m: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Create Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign employees dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Field Agents — {assignTarget?.name}</DialogTitle>
            <DialogDescription>
              Only employees flagged as field agents appear here. Enable it from the Employees page first.
            </DialogDescription>
          </DialogHeader>
          {assignLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : assignable.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No field agents yet. Mark employees as field agents from the Employees page.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {assignable.map((emp) => (
                <label
                  key={emp.employee_id}
                  className="flex items-center gap-3 py-2 px-1 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={emp.assigned}
                    disabled={assigning}
                    onCheckedChange={() => toggleAssignment(emp)}
                  />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {emp.emp_code}{emp.department ? ` · ${emp.department}` : ''}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
