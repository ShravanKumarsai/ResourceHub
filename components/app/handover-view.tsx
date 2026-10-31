'use client'

import { useEffect, useState } from 'react'
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { recordBookingCondition } from '@/app/bookings/actions'
import { BookingList } from '@/components/app/booking-list'
import { ConditionDialog } from '@/components/app/condition-dialog'
import { EmptyState, PageHeader, SectionCard } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { CONDITION_LABEL, formatDateTime, getTodayIso } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import type { Booking, ConditionRating, Role } from '@/lib/types'

function normalizeBookingStatus(value: string) {
  return value === 'in_use' ? 'in-use' : value
}

async function loadHandoverData(role: Role) {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return { bookings: [], resourceNames: {} as Record<string, string> }
  }

  let resourceIds: string[] = []
  let bookingsResult

  if (role === 'student') {
    bookingsResult = await supabase
      .from('bookings')
      .select('*')
      .eq('requester_user_id', userData.user.id)
      .in('status', ['approved', 'in_use', 'completed'])
      .order('starts_at', { ascending: false })
  } else {
    const { data: ownedResources, error: resourceError } = await supabase
      .from('resources')
      .select('id')
      .eq('owner_user_id', userData.user.id)

    if (resourceError) throw resourceError
    resourceIds = (ownedResources ?? []).map((resource) => resource.id)
    if (!resourceIds.length) {
      return { bookings: [], resourceNames: {} }
    }

    bookingsResult = await supabase
      .from('bookings')
      .select('*')
      .in('resource_id', resourceIds)
      .in('status', ['approved', 'in_use', 'completed'])
      .order('starts_at', { ascending: false })
  }

  if (bookingsResult.error) throw bookingsResult.error
  const bookingIds = (bookingsResult.data ?? []).map((booking) => booking.id)
  const resourceMap: Record<string, string> = {}

  const [resourceResult, conditionResult] = await Promise.all([
    resourceIds.length || (bookingsResult.data ?? []).length
      ? supabase
          .from('resources')
          .select('id, name')
          .in('id', [...new Set((bookingsResult.data ?? []).map((booking) => booking.resource_id))])
      : Promise.resolve({ data: [], error: null }),
    bookingIds.length
      ? supabase.from('condition_reports').select('*').in('booking_id', bookingIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (resourceResult.error) throw resourceResult.error
  if (conditionResult.error) throw conditionResult.error

  ;(resourceResult.data ?? []).forEach((resource) => {
    resourceMap[resource.id] = resource.name
  })

  const conditionsByBooking = new Map<string, { checkOut?: any; checkIn?: any }>()
  ;(conditionResult.data ?? []).forEach((report) => {
    const entry = conditionsByBooking.get(report.booking_id) ?? {}
    if (report.phase === 'check_out') entry.checkOut = report
    if (report.phase === 'check_in') entry.checkIn = report
    conditionsByBooking.set(report.booking_id, entry)
  })

  const bookings: Booking[] = (bookingsResult.data ?? []).map((booking) => {
    const start = new Date(booking.starts_at)
    const end = new Date(booking.ends_at)
    const mapped: Booking = {
      id: booking.id,
      resourceId: booking.resource_id,
      requesterId: booking.requester_user_id,
      requesterName: 'Requester',
      requesterAffiliation: 'Institution',
      date: booking.starts_at.slice(0, 10),
      start: start.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }),
      end: end.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }),
      purpose: booking.purpose,
      status: normalizeBookingStatus(booking.status) as Booking['status'],
      createdAt: booking.created_at,
      decisionNote: booking.decision_note ?? undefined,
    }

    const conditionReport = conditionsByBooking.get(booking.id)
    if (conditionReport?.checkOut) {
      mapped.checkOut = {
        rating: conditionReport.checkOut.rating,
        notes: conditionReport.checkOut.notes,
        checklist: conditionReport.checkOut.checklist,
        recordedAt: conditionReport.checkOut.recorded_at,
        recordedBy: 'Recorder',
      }
    }
    if (conditionReport?.checkIn) {
      mapped.checkIn = {
        rating: conditionReport.checkIn.rating,
        notes: conditionReport.checkIn.notes,
        checklist: conditionReport.checkIn.checklist,
        recordedAt: conditionReport.checkIn.recorded_at,
        recordedBy: 'Recorder',
      }
    }
    return mapped
  })

  return { bookings, resourceNames: resourceMap }
}

export function HandoverView({ role }: { role: Role }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ booking: Booking; mode: 'out' | 'in' } | null>(null)
  const today = getTodayIso()

  async function refresh() {
    try {
      setLoading(true)
      const result = await loadHandoverData(role)
      setBookings(result.bookings)
      setResourceNames(result.resourceNames)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Handover records could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [role])

  const ready = bookings.filter((booking) => booking.status === 'approved' && booking.date <= today)
  const inUse = bookings.filter((booking) => booking.status === 'in-use')
  const upcoming = bookings.filter((booking) => booking.status === 'approved' && booking.date > today)
  const done = bookings.filter((booking) => booking.status === 'completed' && booking.checkIn).slice(0, 5)

  async function handleConditionReport(report: {
    rating: ConditionRating
    notes: string
    checklist: string[]
    recordedAt: string
    recordedBy: string
  }) {
    if (!dialog) return false

    try {
      await recordBookingCondition({
        bookingId: dialog.booking.id,
        phase: dialog.mode === 'out' ? 'check_out' : 'check_in',
        rating: report.rating,
        notes: report.notes,
        checklist: report.checklist,
      })
      toast.success(dialog.mode === 'out' ? 'Checked out' : 'Checked in', {
        description: `${resourceNames[dialog.booking.resourceId] ?? 'Resource'} (${dialog.booking.id}) recorded as ${CONDITION_LABEL[report.rating].toLowerCase()}.`,
      })
      await refresh()
      setDialog(null)
      return true
    } catch (conditionError) {
      toast.error(conditionError instanceof Error ? conditionError.message : 'Could not save the condition report.')
      return false
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-in / Check-out"
        description={
          role === 'student'
            ? 'Record the condition of a resource when you collect it and when you return it.'
            : 'Record handovers for bookings on your resources and review the condition history.'
        }
      />

      {loading ? (
        <p className="text-ink-muted text-sm">Loading handover records…</p>
      ) : error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          <SectionCard title="Ready for check-out" description="Approved sessions scheduled for today or earlier.">
            {ready.length ? (
              <BookingList
                bookings={ready}
                role={role}
                showRequester={role === 'owner'}
                resourceNameMap={resourceNames}
                renderActions={(booking) => (
                  <Button size="sm" onClick={() => setDialog({ booking, mode: 'out' })}>
                    Check out
                  </Button>
                )}
              />
            ) : (
              <EmptyState icon={ArrowLeftRight} title="Nothing to check out" description="Approved sessions for today will appear here." />
            )}
          </SectionCard>

          <SectionCard title="In use" description="Sessions that are checked out and need a return report.">
            {inUse.length ? (
              <BookingList
                bookings={inUse}
                role={role}
                showRequester={role === 'owner'}
                resourceNameMap={resourceNames}
                renderActions={(booking) => (
                  <Button size="sm" onClick={() => setDialog({ booking, mode: 'in' })}>
                    Check in
                  </Button>
                )}
              />
            ) : (
              <EmptyState icon={CheckCircle2} title="No resources in use" description="Checked-out resources awaiting return will appear here." />
            )}
          </SectionCard>

          {upcoming.length ? (
            <SectionCard title="Upcoming sessions" description="Check-out becomes available on the day of the session.">
              <BookingList bookings={upcoming} role={role} showRequester={role === 'owner'} resourceNameMap={resourceNames} />
            </SectionCard>
          ) : null}

          {done.length ? (
            <SectionCard title="Recent condition reports">
              <ul className="divide-line-muted divide-y">
                {done.map((booking) => (
                  <li key={booking.id} className="py-3 text-sm first:pt-0 last:pb-0">
                    <p className="font-semibold">{resourceNames[booking.resourceId] ?? 'Resource'}</p>
                    <p className="text-ink-muted mt-0.5 text-[13px]">
                      {booking.id} · returned {formatDateTime(booking.checkIn!.recordedAt)} · condition{' '}
                      {CONDITION_LABEL[booking.checkIn!.rating].toLowerCase()}
                      {booking.checkIn!.notes ? ` · ${booking.checkIn!.notes}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </>
      )}

      {dialog ? (
        <ConditionDialog
          key={`${dialog.booking.id}-${dialog.mode}`}
          open
          onOpenChange={(openState) => !openState && setDialog(null)}
          mode={dialog.mode}
          resourceName={resourceNames[dialog.booking.resourceId] ?? 'resource'}
          recordedBy={role === 'student' ? 'Student' : 'Owner'}
          onSubmit={(report) => {
            void handleConditionReport(report)
            return false
          }}
        />
      ) : null}
    </div>
  )
}
