'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Camera, Loader2, LogIn, LogOut } from 'lucide-react'
import { toast } from 'sonner'

interface FieldPunchRow {
  id: string
  direction: 'IN' | 'OUT'
  status: 'accepted' | 'rejected'
  punch_time: string
  geofence: { name: string } | null
}

/**
 * GPS punch-in/out widget for field agents. Renders nothing for employees
 * who aren't flagged is_field_agent — checked client-side against the
 * employee record since the session doesn't carry that flag.
 */
export default function FieldPunchWidget() {
  const { data: session } = useSession()
  const employeeId = session?.user?.employee_id

  const [checked, setChecked] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [punches, setPunches] = useState<FieldPunchRow[]>([])
  const [selfie, setSelfie] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!employeeId) { setChecked(true); return }
    try {
      const [empRes, punchRes] = await Promise.all([
        fetch(`/api/employees/${employeeId}`),
        fetch('/api/field-punch'),
      ])
      const empJson = await empRes.json()
      const punchJson = await punchRes.json()
      setEnabled(Boolean(empJson.success && empJson.data.is_field_agent))
      if (punchJson.success) setPunches(punchJson.data)
    } catch {
      // Silent — widget just won't show if we can't confirm eligibility.
    } finally {
      setChecked(true)
    }
  }, [employeeId])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  if (!checked || !enabled) return null

  const lastAccepted = [...punches].reverse().find(p => p.status === 'accepted') ?? null
  const nextDirection: 'IN' | 'OUT' = lastAccepted?.direction === 'IN' ? 'OUT' : 'IN'

  async function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported on this device/browser.'))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
      })
    })
  }

  async function handlePunch() {
    setSubmitting(true)
    try {
      let position: GeolocationPosition
      try {
        position = await getPosition()
      } catch {
        toast.error('Could not get your location — enable location access and try again.')
        return
      }

      let selfie_key: string | undefined
      if (selfie) {
        const form = new FormData()
        form.append('file', selfie)
        form.append('category', 'attendance')
        form.append('sub_id', employeeId!)
        form.append('doc_type', 'field_punch_selfie')
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: form })
        const uploadJson = await uploadRes.json()
        if (uploadJson.success) selfie_key = uploadJson.data.key
        else toast.error('Selfie upload failed — punching without it')
      }

      const res = await fetch('/api/field-punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: nextDirection,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          selfie_key,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Punched ${nextDirection === 'IN' ? 'in' : 'out'} at ${json.data.geofence?.name ?? 'site'}`)
        setSelfie(null)
        fetchStatus()
      } else {
        toast.error(json.error ?? 'Punch failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Field Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lastAccepted && (
          <p className="text-xs text-muted-foreground">
            Last punch: {lastAccepted.direction === 'IN' ? 'In' : 'Out'} at{' '}
            {new Date(lastAccepted.punch_time).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
            })}
            {lastAccepted.geofence?.name ? ` — ${lastAccepted.geofence.name}` : ''}
          </p>
        )}

        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={e => setSelfie(e.target.files?.[0] ?? null)}
            />
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              <Camera className="h-3 w-3" />
              {selfie ? 'Selfie added' : 'Add selfie (optional)'}
            </span>
          </label>

          <Button onClick={handlePunch} disabled={submitting} className="ml-auto">
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : nextDirection === 'IN'
                ? <LogIn className="h-4 w-4 mr-1.5" />
                : <LogOut className="h-4 w-4 mr-1.5" />
            }
            Punch {nextDirection === 'IN' ? 'In' : 'Out'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
