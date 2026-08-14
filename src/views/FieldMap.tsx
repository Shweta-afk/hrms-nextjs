'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import AppLayout from '@/components/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Map as MapIcon } from 'lucide-react'
import { toast } from 'sonner'
import { todayIST } from '@/lib/ist-date'
import type { MapPunch } from '@/components/FieldPunchMap'

interface RawFieldPunch {
  id: string
  direction: 'IN' | 'OUT'
  status: 'accepted' | 'rejected'
  punch_time: string
  latitude: string | number
  longitude: string | number
  geofence: { id: string; name: string; latitude: string | number; longitude: string | number } | null
}

const FieldPunchMap = dynamic(() => import('@/components/FieldPunchMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
})

interface FieldAgent {
  id: string
  emp_code: string
  first_name: string
  last_name: string
}

export default function FieldMap() {
  const [agents, setAgents] = useState<FieldAgent[]>([])
  const [employeeId, setEmployeeId] = useState<string>('')
  const [date, setDate] = useState(() => todayIST().toISOString().slice(0, 10))
  const [punches, setPunches] = useState<MapPunch[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/employees?field_agents_only=true&limit=200')
        const json = await res.json()
        if (json.success) {
          setAgents(json.data.employees)
          if (json.data.employees.length > 0) setEmployeeId(json.data.employees[0].id)
        }
      } catch {
        toast.error('Failed to load field agents')
      }
    })()
  }, [])

  const fetchPunches = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/field-punch?employee_id=${employeeId}&date=${date}`)
      const json = await res.json()
      if (json.success) {
        setPunches((json.data as RawFieldPunch[]).map((p) => ({
          ...p,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          geofence: p.geofence
            ? { ...p.geofence, latitude: Number(p.geofence.latitude), longitude: Number(p.geofence.longitude) }
            : null,
        })))
      } else {
        toast.error(json.error ?? 'Failed to load punches')
      }
    } catch {
      toast.error('Failed to load punches')
    } finally {
      setLoading(false)
    }
  }, [employeeId, date])

  useEffect(() => { fetchPunches() }, [fetchPunches])

  const acceptedCount = punches.filter(p => p.status === 'accepted').length
  const rejectedCount = punches.filter(p => p.status === 'rejected').length

  return (
    <AppLayout title="Field Agent Map">
      <div className="mb-5">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <MapIcon className="h-5 w-5" /> Field Agent Map
        </h1>
        <p className="text-sm text-muted-foreground">
          Punch points for a field agent&apos;s day, connected in visit order.
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[220px]">
            <Label>Field Agent</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.first_name} {a.last_name} ({a.emp_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} max={todayIST().toISOString().slice(0, 10)} />
          </div>
          {!loading && punches.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {acceptedCount} accepted{rejectedCount > 0 ? `, ${rejectedCount} rejected` : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No field agents yet. Enable field attendance for employees from the Employees page.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Route</CardTitle>
          </CardHeader>
          <CardContent className="h-[500px] p-0 overflow-hidden rounded-b-xl">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <FieldPunchMap punches={punches} />
            )}
          </CardContent>
        </Card>
      )}
    </AppLayout>
  )
}
