import type { IncidentSeverity, IncidentStatus } from '@/lib/types'

export type IncidentViewRole = 'student' | 'owner' | 'institution'

export interface IncidentWorkspaceResource {
  id: string
  name: string
}

export interface IncidentWorkspaceBooking {
  id: string
  resourceId: string
  startsAt: string
  status: string
}

export interface IncidentWorkspaceEvent {
  at: string
  by: string
  text: string
}

export interface IncidentWorkspaceRecord {
  id: string
  resourceId: string
  bookingId: string | null
  reportedById: string
  reportedBy: string
  severity: IncidentSeverity
  status: IncidentStatus
  title: string
  description: string
  createdAt: string
  history: IncidentWorkspaceEvent[]
}

export interface IncidentWorkspaceData {
  incidents: IncidentWorkspaceRecord[]
  resources: IncidentWorkspaceResource[]
  bookings: IncidentWorkspaceBooking[]
}
