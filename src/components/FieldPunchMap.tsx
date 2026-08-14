'use client'

import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet'
import { DivIcon, LatLngBoundsExpression } from 'leaflet'
import { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'

export interface MapPunch {
  id: string
  direction: 'IN' | 'OUT'
  status: 'accepted' | 'rejected'
  punch_time: string
  latitude: number
  longitude: number
  geofence: { id: string; name: string; latitude: number; longitude: number } | null
}

const dotIcon = (color: string) =>
  new DivIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,0.5)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })

const ICONS = {
  accepted_IN:  dotIcon('#16a34a'), // green
  accepted_OUT: dotIcon('#2563eb'), // blue
  rejected:     dotIcon('#dc2626'), // red
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] })
  }, [bounds, map])
  return null
}

export default function FieldPunchMap({ punches }: { punches: MapPunch[] }) {
  if (punches.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No punches for this day yet.
      </div>
    )
  }

  const path = punches.map(p => [p.latitude, p.longitude] as [number, number])
  const bounds: LatLngBoundsExpression = path

  const geofences = new Map<string, { name: string; latitude: number; longitude: number }>()
  for (const p of punches) {
    if (p.geofence) geofences.set(p.geofence.id, p.geofence)
  }

  return (
    <MapContainer center={path[0]} zoom={15} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds bounds={bounds} />

      <Polyline positions={path} pathOptions={{ color: '#6366f1', weight: 3, opacity: 0.7, dashArray: '6 6' }} />

      {[...geofences.values()].map(g => (
        <Circle
          key={g.name}
          center={[g.latitude, g.longitude]}
          radius={200}
          pathOptions={{ color: '#6366f1', fillOpacity: 0.05, weight: 1 }}
        />
      ))}

      {punches.map((p, i) => {
        const icon = p.status === 'rejected' ? ICONS.rejected : ICONS[`accepted_${p.direction}`]
        return (
          <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icon}>
            <Popup>
              <div className="text-xs space-y-0.5">
                <div className="font-semibold">
                  #{i + 1} {p.direction === 'IN' ? 'Punch In' : 'Punch Out'}
                  {p.status === 'rejected' && ' (rejected)'}
                </div>
                <div>{new Date(p.punch_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })}</div>
                {p.geofence && <div>{p.geofence.name}</div>}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
