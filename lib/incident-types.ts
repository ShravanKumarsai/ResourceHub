import type { IncidentSeverity, IncidentStatus } from '@/lib/types'

export type IncidentViewRole = 'student' | 'owner' | 'institution'

export interface IncidentWorkspaceResource {
  id: string
  institutionId: string
  name: string
}

export interface IncidentWorkspaceBooking {
  id: string
  resourceId: string
  startsAt: string
  status: string
}

export interface IncidentWorkspaceEvent {
  id: string
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
  evidenceUrls: string[]
  lateFlagCount: number | null
  lateFlagThreshold: number | null
  history: IncidentWorkspaceEvent[]
}

export interface IncidentWorkspaceData {
  incidents: IncidentWorkspaceRecord[]
  resources: IncidentWorkspaceResource[]
  bookings: IncidentWorkspaceBooking[]
  hasMore: boolean
  nextCursor: string | null
}
