'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarX } from 'lucide-react'
import { toast } from 'sonner'
import { cancelBookingRequest } from '@/app/bookings/actions'
import { BookingList } from '@/components/app/booking-list'
import { EmptyState, PageHeader, SectionCard } from '@/components/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { BOOKING_STATUS_LABEL, getTodayIso } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { Booking, BookingStatus, WaitingListEntry } from '@/lib/types'

const FILTERS: { value: 'all' | BookingStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: BOOKING_STATUS_LABEL.pending },
  { value: 'approved', label: BOOKING_STATUS_LABEL.approved },
  { value: 'in-use', label: BOOKING_STATUS_LABEL['in-use'] },
  { value: 'completed', label: BOOKING_STATUS_LABEL.completed },
  { value: 'rejected', label: BOOKING_STATUS_LABEL.rejected },
  { value: 'cancelled', label: BOOKING_STATUS_LABEL.cancelled },
]

const DATE_FILTERS = [
  { value: 'all', label: 'All dates' },
  { value: 'future', label: 'Future only' },
  { value: 'past', label: 'Past only' },
  { value: 'this-month', label: 'This month' },
] as const

function normalizeBookingStatus(value: string): BookingStatus {
  return value === 'in_use' ? 'in-use' : (value as BookingStatus)
}

function isoToLocalDate(iso: string) {
  return iso.slice(0, 10)
}

async function loadStudentBookingData() {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return { bookings: [], waitingList: [], resourceNames: {} as Record<string, string> }
  }

  const { data: bookingsData, error: bookingsError } = await supabase
    .from('bookings')
    .select('*')
    .eq('requester_user_id', userData.user.id)
    .order('starts_at', { ascending: false })

  if (bookingsError) throw bookingsError

  const bookingIds = (bookingsData ?? []).map((booking) => booking.id)
  const resourceIds = [...new Set((bookingsData ?? []).map((booking) => booking.resource_id))]
  const requesterIds = [...new Set((bookingsData ?? []).map((booking) => booking.requester_user_id))]

  const [resourceResult, profileResult, conditionResult, waitingResult] = await Promise.all([
    resourceIds.length
      ? supabase.from('resources').select('id, name').in('id', resourceIds)
      : Promise.resolve({ data: [], error: null }),
    requesterIds.length
      ? supabase.from('profiles').select('id, display_name').in('id', requesterIds)
      : Promise.resolve({ data: [], error: null }),
    bookingIds.length
      ? supabase.from('condition_reports').select('*').in('booking_id', bookingIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('waiting_list_entries')
      .select('*')
      .eq('requester_user_id', userData.user.id)
      .order('starts_at', { ascending: false }),
  ])

  if (resourceResult.error) throw resourceResult.error
  if (profileResult.error) throw profileResult.error
  if (conditionResult.error) throw conditionResult.error
  if (waitingResult.error) throw waitingResult.error

  const resourceNames = Object.fromEntries(
    (resourceResult.data ?? []).map((resource) => [resource.id, resource.name]),
  )
  const profileNames = Object.fromEntries(
    (profileResult.data ?? []).map((profile) => [profile.id, profile.display_name || 'Student']),
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
      requesterName: profileNames[booking.requester_user_id] ?? 'Student',
      requesterAffiliation: 'Institution',
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
        recordedBy: profileNames[conditionReport.checkOut.recorded_by] ?? 'User',
      }
    }

    if (conditionReport?.checkIn) {
      mapped.checkIn = {
        rating: conditionReport.checkIn.rating,
        notes: conditionReport.checkIn.notes,
        checklist: conditionReport.checkIn.checklist,
        recordedAt: conditionReport.checkIn.recorded_at,
        recordedBy: profileNames[conditionReport.checkIn.recorded_by] ?? 'User',
      }
    }

    return mapped
  })

  const waitingList: WaitingListEntry[] = (waitingResult.data ?? []).map((entry) => ({
    id: entry.id,
    resourceId: entry.resource_id,
    userId: entry.requester_user_id,
    userName: profileNames[entry.requester_user_id] ?? 'Student',
    date: isoToLocalDate(entry.starts_at),
    start: new Date(entry.starts_at).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }),
    end: new Date(entry.ends_at).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }),
    status: entry.status as WaitingListEntry['status'],
    createdAt: entry.created_at,
    position: 1,
  }))

  return { bookings, waitingList, resourceNames }
}

export function StudentBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([])
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all')
  const [dateFilter, setDateFilter] = useState<(typeof DATE_FILTERS)[number]['value']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const today = getTodayIso()

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        const result = await loadStudentBookingData()
        if (!active) return
        setBookings(result.bookings)
        setWaitingList(result.waitingList)
        setResourceNames(result.resourceNames)
        setError(null)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Bookings could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const mine = useMemo(() => bookings.slice().sort((a, b) => `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`)), [bookings])

  const shown = useMemo(() => {
    return mine.filter((booking) => {
      const statusMatch = statusFilter === 'all' || booking.status === statusFilter
      const dateMatch = (() => {
        switch (dateFilter) {
          case 'future':
            return booking.date >= today
          case 'past':
            return booking.date < today
          case 'this-month': {
            const now = new Date()
            const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
            const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
            return booking.date >= firstOfMonth.toISOString().slice(0, 10) && booking.date <= monthEnd.toISOString().slice(0, 10)
          }
          default:
            return true
        }
      })()
      return statusMatch && dateMatch
    })
  }, [dateFilter, mine, statusFilter, today])

  async function handleCancel(bookingId: string) {
    setCancelingId(bookingId)
    try {
      await cancelBookingRequest(bookingId)
      setBookings((current) => current.map((booking) => booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking))
      toast.success('Booking cancelled')
    } catch (cancelError) {
      toast.error(cancelError instanceof Error ? cancelError.message : 'Could not cancel this booking.')
    } finally {
      setCancelingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My bookings"
        description="Track requests, approvals, and completed sessions."
        actions={
          <Link href="/student/explore" className={buttonVariants()}>
            New booking
          </Link>
        }
      />

      <div className="surface-panel p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={statusFilter === f.value}
                onClick={() => setStatusFilter(f.value)}
                className={
                  statusFilter === f.value
                    ? 'bg-navy h-9 rounded-full px-4 text-[13px] font-medium text-white shadow-sm'
                    : 'border-line hover:bg-surface h-9 rounded-full border bg-white px-4 text-[13px] font-medium text-ink-muted transition-colors'
                }
              >
                {f.label}
                <span className="ml-1.5 opacity-70">
                  {f.value === 'all' ? mine.length : mine.filter((b) => b.status === f.value).length}
                </span>
              </button>
            ))}
          </div>
          <div className="min-w-[180px] xl:max-w-[220px]">
            <NativeSelect value={dateFilter} onChange={(event) => setDateFilter(event.target.value as (typeof DATE_FILTERS)[number]['value'])}>
              {DATE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </div>

      <SectionCard>
        {loading ? (
          <p className="text-ink-muted text-sm">Loading your bookings…</p>
        ) : error ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : shown.length ? (
          <BookingList
            bookings={shown}
            role="student"
            resourceNameMap={resourceNames}
            renderActions={(b) => {
              const cancellable = (b.status === 'pending' || b.status === 'approved') && b.date >= today
              return (
                <>
                  {b.decisionNote ? (
                    <p className="text-ink-muted max-w-xs text-xs sm:text-right">Owner note: {b.decisionNote}</p>
                  ) : null}
                  {cancellable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancelingId === b.id}
                      onClick={() => handleCancel(b.id)}
                    >
                      {cancelingId === b.id ? 'Cancelling…' : 'Cancel'}
                    </Button>
                  ) : null}
                </>
              )
            }}
          />
        ) : (
          <EmptyState
            icon={CalendarX}
            title="No bookings found"
            description="No bookings match this filter yet."
            action={
              <Link href="/student/explore" className={buttonVariants({ variant: 'outline' })}>
                Explore resources
              </Link>
            }
          />
        )}
      </SectionCard>

      <SectionCard title={`Waiting list (${waitingList.filter((entry) => entry.status === 'waiting').length})`} description="Slots you are waiting to become available.">
        {waitingList.filter((entry) => entry.status === 'waiting').length ? (
          <div className="divide-line-muted divide-y">
            {waitingList.filter((entry) => entry.status === 'waiting').map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{resourceNames[entry.resourceId] ?? 'Resource'}</p>
                  <p className="text-ink-muted mt-1 text-xs">{entry.date} · {entry.start}–{entry.end}</p>
                </div>
                <span className="bg-status-pending-bg text-status-pending rounded-full px-3 py-1 text-xs font-medium">Waiting</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-muted text-sm">You are not on any waiting lists.</p>
        )}
      </SectionCard>
    </div>
  )
}
