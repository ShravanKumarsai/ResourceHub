import type {
  Availability,
  BookingStatus,
  ConditionRating,
  IncidentSeverity,
  IncidentStatus,
} from './types'

export function formatDate(iso: string, opts?: { weekday?: boolean; year?: boolean }) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: opts?.weekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: opts?.year === false ? undefined : 'numeric',
  })
}

export function getTodayIso() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
  const time = d.toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${date}, ${time}`
}

export function durationHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd
}

export function formatPrice(rate: number) {
  return rate === 0 ? 'No charge' : `£${rate} / hour`
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  'in-use': 'In use',
  completed: 'Completed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'Available',
  limited: 'Limited availability',
  unavailable: 'Unavailable',
}

export const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
}

export const CONDITION_LABEL: Record<ConditionRating, string> = {
  excellent: 'Excellent',
  good: 'Good',
  minor_wear: 'Minor wear',
  damaged: 'Damaged',
}
