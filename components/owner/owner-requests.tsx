'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  ListFilter,
  Search,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { reviewBookingRequest } from '@/app/bookings/actions'
import { BookingList } from '@/components/app/booking-list'
import { BookingStatusBadge } from '@/components/status-badge'
import { EmptyState, PageHeader, SectionCard } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { BOOKING_STATUS_LABEL, formatDate, formatDateTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { Booking, BookingStatus } from '@/lib/types'

const DATE_FILTERS = [
  { value: 'all', label: 'All dates' },
  { value: 'future', label: 'Future only' },
  { value: 'past', label: 'Past only' },
  { value: 'this-month', label: 'This month' },
] as const

const STATUS_FILTERS: Array<{ value: 'all' | BookingStatus; label: string }> = [
  { value: 'all', label: 'All requests' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'in-use', label: 'In use' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
]

function normalizeBookingStatus(value: string): BookingStatus {
  return value === 'in_use' ? 'in-use' : (value as BookingStatus)
}

function isoToLocalDate(iso: string) {
  return iso.slice(0, 10)
}

async function loadOwnerBookingData() {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return { bookings: [], resourceNames: {} as Record<string, string>, requesterNames: {} as Record<string, string> }
  }

  const { data: ownedResources, error: resourceError } = await supabase
    .from('resources')
    .select('id, name, owner_user_id, institution_id')
    .eq('owner_user_id', userData.user.id)

  if (resourceError) throw resourceError
  const resourceIds = (ownedResources ?? []).map((resource) => resource.id)
  if (!resourceIds.length) {
    return { bookings: [], resourceNames: {}, requesterNames: {} }
  }

  const { data: bookingsData, error: bookingsError } = await supabase
    .from('bookings')
    .select('*')
    .in('resource_id', resourceIds)
    .order('starts_at', { ascending: false })

  if (bookingsError) throw bookingsError

  const bookingIds = (bookingsData ?? []).map((booking) => booking.id)
  const requesterIds = [...new Set((bookingsData ?? []).map((booking) => booking.requester_user_id))]
  const [profileResult, conditionResult] = await Promise.all([
    requesterIds.length
      ? supabase.from('profiles').select('id, display_name').in('id', requesterIds)
      : Promise.resolve({ data: [], error: null }),
    bookingIds.length
      ? supabase.from('condition_reports').select('*').in('booking_id', bookingIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (profileResult.error) throw profileResult.error
  if (conditionResult.error) throw conditionResult.error

  const requesterIdentityResult = requesterIds.length
    ? await supabase.rpc('list_owned_booking_requesters', {
        p_requester_user_ids: requesterIds,
      })
    : { data: [], error: null }

  if (requesterIdentityResult.error) throw requesterIdentityResult.error

  const resourceNames = Object.fromEntries((ownedResources ?? []).map((resource) => [resource.id, resource.name]))
  const requesterIdentities = Object.fromEntries(
    (requesterIdentityResult.data ?? []).map((identity) => [
      identity.requester_user_id,
      { name: identity.requester_name, email: identity.requester_email },
    ]),
  )
  const requesterNames = Object.fromEntries(
    (profileResult.data ?? []).map((profile) => [profile.id, profile.display_name || 'User']),
  )
  const conditionsByBooking = new Map<string, { checkOut?: any; checkIn?: any }>()
  ;(conditionResult.data ?? []).forEach((report) => {
    const entry = conditionsByBooking.get(report.booking_id) ?? {}
    if (report.phase === 'check_out') entry.checkOut = report
    if (report.phase === 'check_in') entry.checkIn = report
    conditionsByBooking.set(report.booking_id, entry)
  })

  const bookings: Booking[] = (bookingsData ?? []).map((booking) => {
    const conditionReport = conditionsByBooking.get(booking.id)
    const start = new Date(booking.starts_at)
    const end = new Date(booking.ends_at)
    const mapped: Booking = {
      id: booking.id,
      resourceId: booking.resource_id,
      requesterId: booking.requester_user_id,
      requesterName:
        requesterIdentities[booking.requester_user_id]?.name ?? requesterNames[booking.requester_user_id] ?? 'Student',
      requesterEmail: requesterIdentities[booking.requester_user_id]?.email ?? undefined,
      requesterAffiliation:
        requesterIdentities[booking.requester_user_id]?.name ?? requesterNames[booking.requester_user_id] ?? 'Verified institutional member',
      date: isoToLocalDate(booking.starts_at),
      start: start.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }),
      end: end.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }),
      purpose: booking.purpose,
      status: normalizeBookingStatus(booking.status),
      createdAt: booking.created_at,
      decisionNote: booking.decision_note ?? undefined,
    }

    if (conditionReport?.checkOut) {
      mapped.checkOut = {
        rating: conditionReport.checkOut.rating,
        notes: conditionReport.checkOut.notes,
        checklist: conditionReport.checkOut.checklist,
        recordedAt: conditionReport.checkOut.recorded_at,
        recordedBy: requesterNames[conditionReport.checkOut.recorded_by] ?? 'User',
      }
    }

    if (conditionReport?.checkIn) {
      mapped.checkIn = {
        rating: conditionReport.checkIn.rating,
        notes: conditionReport.checkIn.notes,
        checklist: conditionReport.checkIn.checklist,
        recordedAt: conditionReport.checkIn.recorded_at,
        recordedBy: requesterNames[conditionReport.checkIn.recorded_by] ?? 'User',
      }
    }

    return mapped
  })

  return { bookings, resourceNames, requesterNames }
}

function RequestCard({
  booking,
  resourceName,
  allBookings,
  onReview,
  reviewing,
}: {
  booking: Booking
  resourceName: string
  allBookings: Booking[]
  onReview: (decision: 'approved' | 'rejected', note: string) => Promise<void>
  reviewing: boolean
}) {
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)

  const conflicts = allBookings.filter((other) => {
    if (other.id === booking.id || other.resourceId !== booking.resourceId) return false
    if (!['approved', 'in-use'].includes(other.status)) return false
    const otherStart = new Date(`${other.date}T${other.start}:00Z`).getTime()
    const otherEnd = new Date(`${other.date}T${other.end}:00Z`).getTime()
    const thisStart = new Date(`${booking.date}T${booking.start}:00Z`).getTime()
    const thisEnd = new Date(`${booking.date}T${booking.end}:00Z`).getTime()
    return thisStart < otherEnd && otherStart < thisEnd
  })

  return (
    <>
      <article
        className={`surface-panel overflow-hidden ${booking.status === 'pending' ? 'border border-teal/30 bg-teal-soft/20' : ''}`}
      >
        <div className="border-b border-line-muted p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="eyebrow">Booking request</span>
                <BookingStatusBadge status={booking.status} />
              </div>
              <h3 className="text-xl font-semibold text-ink">{resourceName}</h3>
              <p className="mt-1.5 text-sm text-ink-muted">Requested by {booking.requesterName}</p>
            </div>
            <div className="text-left text-xs text-ink-muted sm:text-right">
              <p>Submitted</p>
              <p className="mt-1 font-medium text-ink">{formatDateTime(booking.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-2xl border border-line bg-surface/60 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Student</p>
              <div className="mt-2 flex items-center gap-2">
                <UserRound className="size-4 text-teal" aria-hidden="true" />
                <span className="font-medium text-ink">{booking.requesterName}</span>
              </div>
              {booking.requesterEmail ? (
                <a
                  href={`mailto:${booking.requesterEmail}`}
                  className="mt-2 block break-all text-xs text-ink-muted underline-offset-2 hover:underline"
                >
                  {booking.requesterEmail}
                </a>
              ) : null}
              <p className="mt-2 text-xs text-ink-muted">{booking.requesterAffiliation}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface/60 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Date & time</p>
              <div className="mt-2 flex items-center gap-2">
                <CalendarDays className="size-4 text-teal" aria-hidden="true" />
                <span className="text-sm font-medium text-ink">
                  {formatDate(booking.date, { weekday: true })}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {booking.start}–{booking.end}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-line bg-surface/60 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Resource</p>
              <p className="mt-2 text-sm font-medium text-ink">{resourceName}</p>
              <p className="mt-2 text-xs text-ink-muted">Booking reference {booking.id}</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface/60 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Purpose</p>
              <p className="mt-2 text-sm leading-6 text-ink">{booking.purpose}</p>
            </div>
          </div>
        </div>

        {conflicts.length ? (
          <div
            role="alert"
            className="mx-5 mb-4 flex items-start gap-3 rounded-2xl border border-status-pending/30 bg-status-pending-bg p-3 text-sm text-status-pending"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Overlaps with {conflicts.map((c) => `${c.requesterName} (${c.start}–${c.end})`).join(', ')}. Approving this request would double-book the resource.
            </p>
          </div>
        ) : null}

        <div className="border-t border-line-muted p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="flex-1">
              <label htmlFor={`note-${booking.id}`} className="mb-1.5 block text-[12px] font-medium text-ink">
                Note to requester <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <Input id={`note-${booking.id}`} value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                View details
              </Button>
              <Button type="button" variant="outline" onClick={() => void onReview('rejected', note)} disabled={reviewing}>
                {reviewing ? 'Saving…' : 'Reject'}
              </Button>
              <Button type="button" onClick={() => void onReview('approved', note)} disabled={reviewing || conflicts.length > 0}>
                {reviewing ? 'Saving…' : 'Approve'}
              </Button>
            </div>
          </div>
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{resourceName}</DialogTitle>
            <DialogDescription>Review full booking context before approving or declining the request.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Student</p>
                <p className="mt-2 font-medium text-ink">{booking.requesterName}</p>
                {booking.requesterEmail ? (
                  <a
                    href={`mailto:${booking.requesterEmail}`}
                    className="mt-1 block break-all text-ink-muted underline-offset-2 hover:underline"
                  >
                    {booking.requesterEmail}
                  </a>
                ) : null}
                <p className="mt-1 text-ink-muted">{booking.requesterAffiliation}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Status</p>
                <div className="mt-2">
                  <BookingStatusBadge status={booking.status} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Purpose</p>
              <p className="mt-2 leading-6 text-ink">{booking.purpose}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Date</p>
                <p className="mt-2 font-medium text-ink">{formatDate(booking.date, { weekday: true })}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Time</p>
                <p className="mt-2 font-medium text-ink">{booking.start}–{booking.end}</p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Booking reference</p>
              <p className="mt-2 text-ink">{booking.id}</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="outline" onClick={() => void onReview('rejected', note)} disabled={reviewing}>
              Decline
            </Button>
            <Button type="button" onClick={() => void onReview('approved', note)} disabled={reviewing || conflicts.length > 0}>
              Approve request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function OwnerRequests() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all')
  const [dateFilter, setDateFilter] = useState<(typeof DATE_FILTERS)[number]['value']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  async function refresh() {
    try {
      setLoading(true)
      const result = await loadOwnerBookingData()
      setBookings(result.bookings)
      setResourceNames(result.resourceNames)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Request data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bookings.filter((booking) => {
      const matchesSearch =
        !q ||
        booking.requesterName.toLowerCase().includes(q) ||
        booking.requesterEmail?.toLowerCase().includes(q) ||
        resourceNames[booking.resourceId]?.toLowerCase().includes(q) ||
        booking.purpose.toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter

      const matchesDate = (() => {
        switch (dateFilter) {
          case 'future':
            return booking.date >= new Date().toISOString().slice(0, 10)
          case 'past':
            return booking.date < new Date().toISOString().slice(0, 10)
          case 'this-month': {
            const now = new Date()
            const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
            const lastOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
            return booking.date >= firstOfMonth.toISOString().slice(0, 10) && booking.date <= lastOfMonth.toISOString().slice(0, 10)
          }
          default:
            return true
        }
      })()

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [bookings, dateFilter, resourceNames, search, statusFilter])

  const pending = filtered.filter((booking) => booking.status === 'pending')
  const approvedCount = filtered.filter((booking) => booking.status === 'approved').length
  const decisionHistoryCount = filtered.filter((booking) => ['rejected', 'cancelled', 'completed', 'in-use'].includes(booking.status)).length
  const decided = filtered.filter((booking) => ['approved', 'rejected', 'cancelled', 'in-use', 'completed'].includes(booking.status))

  async function handleReview(bookingId: string, decision: 'approved' | 'rejected', note: string) {
    setReviewingId(bookingId)
    try {
      await reviewBookingRequest({ bookingId, decision, note: note.trim() || undefined })
      toast.success(decision === 'approved' ? 'Request approved' : 'Request declined')
      await refresh()
    } catch (reviewError) {
      toast.error(reviewError instanceof Error ? reviewError.message : 'Could not update this booking.')
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking review"
        description="Review pending requests, check scheduled availability, and approve or reject bookings with context."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Pending</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{pending.length}</p>
          <p className="mt-1 text-xs text-ink-muted">Needs attention</p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Approved</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{approvedCount}</p>
          <p className="mt-1 text-xs text-ink-muted">Currently authorise</p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Recent decisions</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{decisionHistoryCount}</p>
          <p className="mt-1 text-xs text-ink-muted">Closed requests</p>
        </div>
      </div>

      <div className="surface-panel p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <Input
              aria-label="Search booking requests"
              placeholder="Search by student, resource or purpose"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex w-full gap-2 xl:w-auto">
            <div className="min-w-[180px] flex-1 xl:flex-none">
              <div className="relative">
                <ListFilter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <NativeSelect
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | BookingStatus)}
                  className="pl-9"
                >
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="min-w-[180px] flex-1 xl:flex-none">
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <NativeSelect
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value as (typeof DATE_FILTERS)[number]['value'])}
                  className="pl-9"
                >
                  {DATE_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-ink-muted text-sm">Loading booking requests…</p>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-status-rejected/30 bg-status-rejected-bg p-4 text-sm text-status-rejected">
          {error}
        </div>
      ) : (
        <>
          <section aria-labelledby="pending-heading" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="pending-heading" className="text-lg font-semibold text-ink">
                Awaiting decision ({pending.length})
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-pending-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-status-pending">
                <CheckCheck className="size-3.5" aria-hidden="true" />
                Pending review
              </span>
            </div>
            {pending.length ? (
              pending.map((booking) => (
                <RequestCard
                  key={booking.id}
                  booking={booking}
                  resourceName={resourceNames[booking.resourceId] ?? 'Resource'}
                  allBookings={bookings}
                  onReview={(decision, note) => handleReview(booking.id, decision, note)}
                  reviewing={reviewingId === booking.id}
                />
              ))
            ) : (
              <EmptyState icon={ClipboardList} title="No pending requests" description="New requests from students and staff will appear here." />
            )}
          </section>

          <SectionCard title="Decision history">
            {decided.length ? (
              <BookingList
                bookings={decided}
                role="owner"
                showRequester
                resourceNameMap={resourceNames}
                renderActions={(booking) =>
                  booking.decisionNote ? (
                    <p className="text-ink-muted max-w-xs text-xs sm:text-right">Note: {booking.decisionNote}</p>
                  ) : null
                }
              />
            ) : (
              <p className="text-ink-muted text-sm">No decisions recorded yet.</p>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
