'use client'

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface ThreatMapCity {
  city: string
  lat: number
  lng: number
  threats: number
  severity: ThreatSeverity
  topThreat: string
  trend: string
}

const severityColor: Record<ThreatSeverity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#a1a1aa',
}

export default function ThreatMapLeaflet({ cities }: { cities: ThreatMapCity[] }) {
  const max = Math.max(...cities.map((c) => c.threats), 1)

  return (
    <MapContainer
      center={[22.5, 80.5]}
      zoom={4.6}
      minZoom={4}
      maxZoom={9}
      scrollWheelZoom={false}
      className="h-full w-full rounded-lg z-0"
      style={{ background: '#000000' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {cities.map((c) => (
        <CircleMarker
          key={c.city}
          center={[c.lat, c.lng]}
          radius={7 + (c.threats / max) * 16}
          pathOptions={{
            color: severityColor[c.severity],
            fillColor: severityColor[c.severity],
            fillOpacity: 0.35,
            weight: 1.5,
          }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong>{c.city}</strong>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <div>Threats: <strong>{c.threats.toLocaleString()}</strong></div>
                <div>Severity: <span style={{ color: severityColor[c.severity], fontWeight: 600, textTransform: 'uppercase' }}>{c.severity}</span></div>
                <div>Top threat: {c.topThreat}</div>
                <div>Trend: {c.trend}</div>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
