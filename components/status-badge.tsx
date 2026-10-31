import { cn } from '@/lib/utils'
import {
  AVAILABILITY_LABEL,
  BOOKING_STATUS_LABEL,
  INCIDENT_STATUS_LABEL,
  SEVERITY_LABEL,
} from '@/lib/format'
import type {
  Availability,
  BookingStatus,
  IncidentSeverity,
  IncidentStatus,
} from '@/lib/types'

type Tone = 'pending' | 'approved' | 'rejected' | 'completed' | 'info' | 'critical'

const TONE_CLASS: Record<Tone, string> = {
  pending: 'bg-status-pending-bg text-status-pending',
  approved: 'bg-status-approved-bg text-status-approved',
  rejected: 'bg-status-rejected-bg text-status-rejected',
  completed: 'bg-status-completed-bg text-status-completed',
  info: 'bg-status-info-bg text-status-info',
  critical: 'bg-status-critical text-white',
}

const DOT_CLASS: Record<Tone, string> = {
  pending: 'bg-status-pending',
  approved: 'bg-status-approved',
  rejected: 'bg-status-rejected',
  completed: 'bg-status-completed',
  info: 'bg-status-info',
  critical: 'bg-white',
}

function Badge({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOT_CLASS[tone])} aria-hidden="true" />
      {children}
    </span>
  )
}

const BOOKING_TONE: Record<BookingStatus, Tone> = {
  pending: 'pending',
  approved: 'approved',
  'in-use': 'info',
  completed: 'completed',
  rejected: 'rejected',
  cancelled: 'completed',
}

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  return (
    <Badge tone={BOOKING_TONE[status]} className={className}>
      {BOOKING_STATUS_LABEL[status]}
    </Badge>
  )
}

const AVAILABILITY_TONE: Record<Availability, Tone> = {
  available: 'approved',
  limited: 'pending',
  unavailable: 'rejected',
}

export function AvailabilityBadge({ availability, className }: { availability: Availability; className?: string }) {
  return (
    <Badge tone={AVAILABILITY_TONE[availability]} className={className}>
      {AVAILABILITY_LABEL[availability]}
    </Badge>
  )
}

const SEVERITY_TONE: Record<IncidentSeverity, Tone> = {
  low: 'completed',
  medium: 'pending',
  high: 'rejected',
  critical: 'critical',
}

export function SeverityBadge({ severity, className }: { severity: IncidentSeverity; className?: string }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} className={className}>
      {SEVERITY_LABEL[severity]}
    </Badge>
  )
}

const INCIDENT_TONE: Record<IncidentStatus, Tone> = {
  open: 'rejected',
  investigating: 'pending',
  resolved: 'approved',
}

export function IncidentStatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  return (
    <Badge tone={INCIDENT_TONE[status]} className={className}>
      {INCIDENT_STATUS_LABEL[status]}
    </Badge>
  )
}
