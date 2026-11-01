export type Role = 'student' | 'owner' | 'institution'

export const CATEGORIES = [
  'Robotics and automation',
  'Manufacturing and fabrication',
  'Electronics and embedded systems',
  'Materials testing',
  'Computing and simulation',
  'Research laboratories',
  'Measurement and instrumentation',
  'Technical workspaces',
] as const

export type Category = (typeof CATEGORIES)[number] | (string & {})

export type Availability = 'available' | 'limited' | 'unavailable'

export interface Spec {
  label: string
  value: string
}

export interface Resource {
  id: string
  institutionId?: string
  ownerMembershipId?: string
  imagePath?: string | null
  name: string
  category: Category
  institution: string
  location: string
  description: string
  image: string
  specs: Spec[]
  highlights: string[]
  availability: Availability
  hourlyRate: number
  maxDurationHours: number
  approval: 'Owner approval' | 'Automatic confirmation'
  eligibility: string[]
  training: string[]
  safety: string[]
  useCases: string[]
  instructions: string[]
  ownerId: string
  ownerName: string
  listed: boolean
}

export interface ResourceOwnerMembership {
  id: string
  institutionId: string
  institutionName: string
}

export interface ResourceSaveInput {
  id?: string
  ownerMembershipId: string
  name: string
  category: Category
  location: string
  description: string
  availability: Availability
  hourlyRate: number
  maxDurationHours: number
  approval: Resource['approval']
  specs: Spec[]
  highlights: string[]
  eligibility: string[]
  training: string[]
  safety: string[]
  useCases: string[]
  instructions: string[]
  listed: boolean
  hasNewImage: boolean
}

export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'in-use'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export type ConditionRating = 'excellent' | 'good' | 'minor_wear' | 'damaged'

export interface ConditionReport {
  rating: ConditionRating
  notes: string
  checklist: string[]
  recordedAt: string
  recordedBy: string
}

export interface Booking {
  id: string
  resourceId: string
  requesterId: string
  requesterName: string
  requesterAffiliation: string
  date: string
  start: string
  end: string
  purpose: string
  status: BookingStatus
  createdAt: string
  decisionNote?: string
  checkOut?: ConditionReport
  checkIn?: ConditionReport
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'open' | 'investigating' | 'resolved'

export interface IncidentEvent {
  at: string
  by: string
  text: string
}

export interface Incident {
  id: string
  resourceId: string
  bookingId?: string
  reportedById: string
  reportedBy: string
  severity: IncidentSeverity
  status: IncidentStatus
  title: string
  description: string
  createdAt: string
  history: IncidentEvent[]
}

export interface WaitingListEntry {
  id: string
  resourceId: string
  userId: string
  userName: string
  date: string
  start: string
  end: string
  status: 'waiting' | 'offered' | 'accepted' | 'expired' | 'cancelled'
  createdAt: string
  position: number | null
}

export interface StoreNotification {
  id: string
  userId: string
  at: string
  text: string
  read: boolean
}

export type ActivityType =
  | 'booking-requested'
  | 'booking-approved'
  | 'booking-rejected'
  | 'booking-cancelled'
  | 'check-out'
  | 'check-in'
  | 'incident'
  | 'resource'

export interface Activity {
  id: string
  at: string
  type: ActivityType
  text: string
  actorId: string
  resourceId?: string
  ownerId?: string
}

export interface DemoUser {
  id: string
  name: string
  initials: string
  email: string
  role: Role
  title: string
  institution: string
  department: string
}
