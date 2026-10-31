'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import {
  ACTIVITY,
  BOOKINGS,
  INCIDENTS,
  RESOURCES,
  USERS,
} from './data'
import { durationHours, getTodayIso, overlaps } from './format'
import type {
  Activity,
  ActivityType,
  Availability,
  Booking,
  ConditionReport,
  DemoUser,
  Incident,
  IncidentSeverity,
  IncidentStatus,
  Resource,
  Role,
  WaitingListEntry,
  StoreNotification,
} from './types'

const STORAGE_KEY = 'resourcehub-demo-v2'
const nowIso = () => new Date().toISOString()
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const isValidDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === Number(date.slice(0, 4)) &&
    parsed.getMonth() + 1 === Number(date.slice(5, 7)) &&
    parsed.getDate() === Number(date.slice(8, 10))
  )
}
const isValidTime = (time: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
const isConditionRating = (rating: string) =>
  ['excellent', 'good', 'minor_wear', 'damaged'].includes(rating)

function validateConditionReport(report: ConditionReport) {
  if (!isConditionRating(report.rating)) throw new Error('Choose a valid condition rating.')
  if (!Array.isArray(report.checklist) || !report.checklist.some((item) => item.trim()))
    throw new Error('Complete the condition checklist before saving the report.')
  if (typeof report.notes !== 'string' || report.notes.trim().length > 2000)
    throw new Error('Condition notes must be 2,000 characters or fewer.')
  if (report.rating === 'damaged' && report.notes.trim().length < 10)
    throw new Error('Add at least 10 characters describing the reported damage.')
}

interface NewBookingInput {
  resourceId: string
  date: string
  start: string
  end: string
  purpose: string
}

interface NewIncidentInput {
  resourceId: string
  bookingId?: string
  severity: IncidentSeverity
  title: string
  description: string
}

interface StoreValue {
  resources: Resource[]
  bookings: Booking[]
  incidents: Incident[]
  activity: Activity[]
  getResource: (id: string) => Resource | undefined
  userFor: (role: Role) => DemoUser
  conflictsFor: (booking: Booking) => Booking[]
  requestBooking: (input: NewBookingInput) => Booking
  decideBooking: (id: string, decision: 'approved' | 'rejected', note?: string) => void
  cancelBooking: (id: string) => void
  checkOut: (id: string, report: ConditionReport) => void
  checkIn: (id: string, report: ConditionReport) => void
  reportIncident: (role: Role, input: NewIncidentInput) => Incident
  updateIncident: (id: string, status: IncidentStatus, note: string, by: string) => void
  saveResource: (resource: Resource) => void
  setListed: (id: string, listed: boolean) => void
  setAvailability: (id: string, availability: Availability) => void
  joinWaitingList: (resourceId: string, date: string, start: string, end: string) => WaitingListEntry
  waitingList: WaitingListEntry[]
  notifications: StoreNotification[]
  markNotificationRead: (id: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [resources, setResources] = useState<Resource[]>(RESOURCES)
  const [bookings, setBookings] = useState<Booking[]>(BOOKINGS)
  const [incidents, setIncidents] = useState<Incident[]>(INCIDENTS)
  const [activity, setActivity] = useState<Activity[]>(ACTIVITY)
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([])
  const [notifications, setNotifications] = useState<StoreNotification[]>([])
  const [hydrated, setHydrated] = useState(false)
  const counters = useRef({ booking: 2051, incident: 106, activity: 13, resource: 9 })

  // Demo persistence only: localStorage survives refreshes on this browser, but is not a secure shared database.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{ resources: Resource[]; bookings: Booking[]; incidents: Incident[]; activity: Activity[]; waitingList: WaitingListEntry[]; notifications: StoreNotification[] }>
        if (Array.isArray(saved.resources)) setResources(saved.resources)
        if (Array.isArray(saved.bookings)) setBookings(saved.bookings)
        if (Array.isArray(saved.incidents)) setIncidents(saved.incidents)
        if (Array.isArray(saved.activity)) setActivity(saved.activity)
        if (Array.isArray(saved.waitingList)) setWaitingList(saved.waitingList)
        if (Array.isArray(saved.notifications)) setNotifications(saved.notifications)
      }
    } catch (error) {
      console.error('Could not restore ResourceHub demo data.', error)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ resources, bookings, incidents, activity, waitingList, notifications }))
    } catch (error) {
      console.error('Could not persist ResourceHub demo data.', error)
    }
  }, [hydrated, resources, bookings, incidents, activity, waitingList, notifications])

  const log = useCallback(
    (type: ActivityType, text: string, actorId: string, resourceId?: string, ownerId?: string) => {
      const id = makeId('A')
      const at = nowIso()
      setActivity((prev) => [{ id, at, type, text, actorId, resourceId, ownerId }, ...prev])
      // Keep an in-app notification trail for important events in this prototype.
      setNotifications((prev) => [{ id: makeId('NTF'), userId: actorId, at, text, read: false }, ...prev].slice(0, 200))
    },
    [],
  )

  const getResource = useCallback(
    (id: string) => resources.find((r) => r.id === id),
    [resources],
  )

  const conflictsFor = useCallback(
    (booking: Booking) =>
      bookings.filter(
        (b) =>
          b.id !== booking.id &&
          b.resourceId === booking.resourceId &&
          b.date === booking.date &&
          (b.status === 'approved' || b.status === 'pending' || b.status === 'in-use') &&
          overlaps(b.start, b.end, booking.start, booking.end),
      ),
    [bookings],
  )

  const requestBooking = useCallback(
    (input: NewBookingInput) => {
      const resource = resources.find((r) => r.id === input.resourceId)
      if (!resource || !resource.listed) throw new Error('This resource is not available for booking.')
      if (resource.availability === 'unavailable') throw new Error('This resource is currently unavailable.')
      if (!isValidDate(input.date) || input.date < getTodayIso()) throw new Error('Choose a valid date that is not in the past.')
      if (!isValidTime(input.start) || !isValidTime(input.end) || input.end <= input.start) throw new Error('Choose a valid start and end time.')
      if (!input.purpose.trim() || input.purpose.trim().length < 15) throw new Error('Please provide a purpose of at least 15 characters.')
      const duration = durationHours(input.start, input.end)
      if (duration <= 0 || duration > resource.maxDurationHours) throw new Error(`Bookings must be between 0 and ${resource.maxDurationHours} hours.`)
      const overlapsExisting = bookings.some((b) => b.resourceId === input.resourceId && b.date === input.date && ['approved', 'in-use'].includes(b.status) && overlaps(b.start, b.end, input.start, input.end))
      if (overlapsExisting) throw new Error('This time conflicts with an existing confirmed booking.')
      const user = USERS.student
      const auto = resource.approval === 'Automatic confirmation'
      const booking: Booking = {
        id: makeId('BK'),
        resourceId: input.resourceId,
        requesterId: user.id,
        requesterName: user.name,
        requesterAffiliation: 'MSc Mechatronic Engineering, NIT',
        date: input.date,
        start: input.start,
        end: input.end,
        purpose: input.purpose,
        status: auto ? 'approved' : 'pending',
        createdAt: nowIso(),
      }
      setBookings((prev) => [booking, ...prev])
      log(
        auto ? 'booking-approved' : 'booking-requested',
        auto
          ? `Booking ${booking.id} for ${resource?.name} was confirmed automatically.`
          : `${user.name} requested ${resource?.name} (${booking.id}).`,
        user.id,
        input.resourceId,
        resource?.ownerId,
      )
      return booking
    },
    [resources, bookings, log],
  )

  const decideBooking = useCallback(
    (id: string, decision: 'approved' | 'rejected', note?: string) => {
      const target = bookings.find((b) => b.id === id)
      if (!target) throw new Error('Booking not found.')
      if (target.status !== 'pending') throw new Error('Only pending bookings can be approved or rejected.')
      const resource = resources.find((r) => r.id === target.resourceId)
      if (decision === 'approved') {
        const conflict = bookings.some((b) => b.id !== id && b.resourceId === target.resourceId && b.date === target.date && ['approved', 'in-use'].includes(b.status) && overlaps(b.start, b.end, target.start, target.end))
        if (conflict) throw new Error('Cannot approve this request because it conflicts with a confirmed booking.')
      }
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: decision, decisionNote: note } : b)))
      log(
        decision === 'approved' ? 'booking-approved' : 'booking-rejected',
        `Booking ${id} for ${resource?.name} was ${decision === 'approved' ? 'approved' : 'declined'} by ${resource?.ownerName}.`,
        resource?.ownerId ?? 'u-owner',
        target.resourceId,
        resource?.ownerId,
      )
    },
    [bookings, resources, log],
  )

  const cancelBooking = useCallback(
    (id: string) => {
      const target = bookings.find((b) => b.id === id)
      if (!target) throw new Error('Booking not found.')
      if (!['pending', 'approved'].includes(target.status)) throw new Error('Only pending or approved bookings can be cancelled.')
      if (target.date < getTodayIso()) throw new Error('Past bookings cannot be cancelled from this screen.')
      const resource = resources.find((r) => r.id === target.resourceId)
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)))
      log(
        'booking-cancelled',
        `Booking ${id} for ${resource?.name} was cancelled by ${target.requesterName}.`,
        target.requesterId,
        target.resourceId,
        resource?.ownerId,
      )
    },
    [bookings, resources, log],
  )

  const checkOut = useCallback(
    (id: string, report: ConditionReport) => {
      const target = bookings.find((b) => b.id === id)
      if (!target) throw new Error('Booking not found.')
      if (target.status !== 'approved') throw new Error('Only approved bookings can be checked out.')
      if (target.date > getTodayIso()) throw new Error('A booking cannot be checked out before its scheduled date.')
      validateConditionReport(report)
      const resource = resources.find((r) => r.id === target.resourceId)
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'in-use', checkOut: { ...report, notes: report.notes.trim(), recordedAt: nowIso() } } : b)))
      log(
        'check-out',
        `${target.requesterName} checked out ${resource?.name} (${id}).`,
        target.requesterId,
        target.resourceId,
        resource?.ownerId,
      )
    },
    [bookings, resources, log],
  )

  const checkIn = useCallback(
    (id: string, report: ConditionReport) => {
      const target = bookings.find((b) => b.id === id)
      if (!target) throw new Error('Booking not found.')
      if (target.status !== 'in-use') throw new Error('Only resources currently in use can be checked in.')
      validateConditionReport(report)
      const resource = resources.find((r) => r.id === target.resourceId)
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'completed', checkIn: { ...report, notes: report.notes.trim(), recordedAt: nowIso() } } : b)))
      log(
        'check-in',
        `${target.requesterName} returned ${resource?.name} (${id}).`,
        target.requesterId,
        target.resourceId,
        resource?.ownerId,
      )
    },
    [bookings, resources, log],
  )

  const reportIncident = useCallback(
    (role: Role, input: NewIncidentInput) => {
      const user = USERS[role]
      const resource = resources.find((r) => r.id === input.resourceId)
      if (!resource) throw new Error('Choose a valid resource.')
      if (role === 'owner' && resource.ownerId !== user.id) throw new Error('You can only report on your own resources.')
      if (role === 'student' && !bookings.some((booking) => booking.requesterId === user.id && booking.resourceId === resource.id))
        throw new Error('You can only report on a resource you have booked.')
      if (input.title.trim().length < 3 || input.description.trim().length < 10)
        throw new Error('Add a title of at least 3 characters and a description of at least 10 characters.')
      if (!['low', 'medium', 'high', 'critical'].includes(input.severity))
        throw new Error('Choose a valid incident severity.')
      if (input.bookingId && !bookings.some((booking) => booking.id === input.bookingId && booking.resourceId === resource.id))
        throw new Error('The selected booking does not match this resource.')
      const incident: Incident = {
        id: makeId('INC'),
        resourceId: input.resourceId,
        bookingId: input.bookingId,
        reportedById: user.id,
        reportedBy: user.name,
        severity: input.severity,
        status: 'open',
        title: input.title.trim(),
        description: input.description.trim(),
        createdAt: nowIso(),
        history: [{ at: nowIso(), by: user.name, text: 'Incident reported.' }],
      }
      setIncidents((prev) => [incident, ...prev])
      log(
        'incident',
        `${user.name} reported an incident (${incident.id}) on ${resource?.name}.`,
        user.id,
        input.resourceId,
        resource?.ownerId,
      )
      return incident
    },
    [resources, bookings, log],
  )

  const updateIncident = useCallback(
    (id: string, status: IncidentStatus, note: string, by: string) => {
      if (!['open', 'investigating', 'resolved'].includes(status)) throw new Error('Choose a valid incident status.')
      const current = incidents.find((item) => item.id === id)
      if (!current) throw new Error('Incident not found.')
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                status,
                history: [
                  ...i.history,
                  {
                    at: nowIso(),
                    by,
                    text: note.trim() || `Status changed to ${status}.`,
                  },
                ],
              }
            : i,
        ),
      )
      log('incident', `Incident ${id} was updated to ${status}: ${note.trim() || 'No additional note.'}`, by, current.resourceId)
    },
    [incidents, log],
  )

  const saveResource = useCallback(
    (resource: Resource) => {
      setResources((prev) => {
        const exists = prev.some((r) => r.id === resource.id)
        return exists ? prev.map((r) => (r.id === resource.id ? resource : r)) : [resource, ...prev]
      })
      log(
        'resource',
        `${resource.name} was ${resource.listed ? 'published' : 'saved as a draft'} by ${resource.ownerName}.`,
        resource.ownerId,
        resource.id,
        resource.ownerId,
      )
    },
    [log],
  )

  const setListed = useCallback((id: string, listed: boolean) => {
    const resource = resources.find((r) => r.id === id)
    if (!resource) return
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, listed } : r)))
    log('resource', `${resource.name} was ${listed ? 'published' : 'unpublished'}.`, resource.ownerId, id, resource.ownerId)
  }, [resources, log])

  const setAvailability = useCallback((id: string, availability: Availability) => {
    const resource = resources.find((r) => r.id === id)
    if (!resource) return
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, availability } : r)))
    log('resource', `${resource.name} availability changed to ${availability}.`, resource.ownerId, id, resource.ownerId)
  }, [resources, log])

  const joinWaitingList = useCallback((resourceId: string, date: string, start: string, end: string) => {
    const resource = resources.find((item) => item.id === resourceId)
    if (!resource) throw new Error('Resource not found.')
    if (!resource.listed || resource.availability === 'unavailable') throw new Error('This resource is not available for booking.')
    if (!isValidDate(date) || date < getTodayIso()) throw new Error('Choose a valid date that is not in the past.')
    if (!isValidTime(start) || !isValidTime(end) || end <= start) throw new Error('Choose a valid time range.')
    const duration = durationHours(start, end)
    if (duration > resource.maxDurationHours) throw new Error(`Sessions are limited to ${resource.maxDurationHours} hours for this resource.`)
    const hasConfirmedConflict = bookings.some(
      (booking) =>
        booking.resourceId === resourceId &&
        booking.date === date &&
        ['approved', 'in-use'].includes(booking.status) &&
        overlaps(booking.start, booking.end, start, end),
    )
    if (!hasConfirmedConflict) throw new Error('Join the waiting list only for a slot blocked by a confirmed booking.')
    const user = USERS.student
    const duplicate = waitingList.find((entry) => entry.resourceId === resourceId && entry.userId === user.id && entry.date === date && entry.start === start && entry.end === end && entry.status === 'waiting')
    if (duplicate) throw new Error('You are already on the waiting list for this time slot.')
    const entry: WaitingListEntry = { id: makeId('WL'), resourceId, userId: user.id, userName: user.name, date, start, end, status: 'waiting', createdAt: nowIso(), position: waitingList.filter((item) => item.resourceId === resourceId && item.date === date && item.start === start && item.end === end && item.status === 'waiting').length + 1 }
    setWaitingList((prev) => [...prev, entry])
    log('resource', `${user.name} joined the waiting list for ${resource.name} (${entry.id}).`, user.id, resourceId, resource.ownerId)
    return entry
  }, [resources, bookings, waitingList, log])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((item) => item.id === id ? { ...item, read: true } : item))
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      resources,
      bookings,
      incidents,
      activity,
      getResource,
      userFor: (role) => USERS[role],
      conflictsFor,
      requestBooking,
      decideBooking,
      cancelBooking,
      checkOut,
      checkIn,
      reportIncident,
      updateIncident,
      saveResource,
      setListed,
      setAvailability,
      joinWaitingList,
      waitingList,
      notifications,
      markNotificationRead,
    }),
    [
      resources,
      bookings,
      incidents,
      activity,
      getResource,
      conflictsFor,
      requestBooking,
      decideBooking,
      cancelBooking,
      checkOut,
      checkIn,
      reportIncident,
      updateIncident,
      saveResource,
      setListed,
      setAvailability,
      joinWaitingList,
      waitingList,
      notifications,
      markNotificationRead,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export function nextResourceId(existing: Resource[]) {
  return `r-${existing.length + 1}-${existing.length * 7 + 11}`
}
