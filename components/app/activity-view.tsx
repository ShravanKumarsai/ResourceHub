'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  CalendarCheck,
  CalendarX,
  CircleDot,
  History,
  PackageCheck,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { loadActivityPage } from '@/app/activity/actions'
import { EmptyState, PageHeader, SectionCard } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'

const EVENT_ICON: Record<string, LucideIcon> = {
  booking_requested: CalendarCheck,
  booking_approved: CircleDot,
  booking_rejected: CalendarX,
  booking_cancelled: CalendarX,
  check_out: ArrowLeftRight,
  check_in: PackageCheck,
  incident_reported: ShieldAlert,
  incident_updated: ShieldAlert,
  resource_created: History,
  resource_updated: History,
}

type ActivityRole = 'student' | 'owner' | 'institution'
type ActivityEvent = Awaited<ReturnType<typeof loadActivityPage>>['events'][number]

export function ActivityView({ role }: { role: ActivityRole }) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPage(nextCursor: string | null, append: boolean) {
    try {
      setError(null)
      const result = await loadActivityPage(role, nextCursor)
      setEvents((current) => {
        if (!append) return result.events
        const existingIds = new Set(current.map((event) => event.id))
        return [
          ...current,
          ...result.events.filter((event) => !existingIds.has(event.id)),
        ]
      })
      setCursor(result.nextCursor)
      setHasMore(result.hasMore)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Activity history could not be loaded.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setEvents([])
    setCursor(null)
    setHasMore(false)
    setLoading(true)
    void loadPage(null, false)
  }, [role])

  const loadMore = () => {
    setLoadingMore(true)
    void loadPage(cursor, true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity history"
        description={
          role === 'student'
            ? 'A record of your booking requests, handovers, and incident reports.'
            : role === 'owner'
              ? 'A record of events on resources you manage and their related bookings or incidents.'
              : 'A record of activity within your institution.'
        }
      />

      {loading ? (
        <p role="status" className="text-ink-muted text-sm">Loading activity history…</p>
      ) : error && !events.length ? (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <Button variant="outline" onClick={() => { setLoading(true); void loadPage(null, false) }}>
            Retry
          </Button>
        </div>
      ) : events.length ? (
        <>
          {error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <SectionCard>
            <ol className="divide-line-muted divide-y">
              {events.map((event) => {
                const Icon = EVENT_ICON[event.eventType] ?? History
                return (
                  <li key={event.id} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
                    <span className="bg-teal-soft text-teal mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-6">{event.summary}</p>
                      <p className="text-ink-muted mt-0.5 text-xs">
                        {event.eventType.replace(/_/g, ' ')} · {formatDateTime(event.createdAt)} · {event.actor}
                      </p>
                      {event.resourceName ? (
                        <p className="text-ink-muted mt-1 text-xs">Resource: {event.resourceName}</p>
                      ) : null}
                      {event.booking ? (
                        <p className="text-ink-muted mt-1 text-xs">
                          Booking {event.booking.id.slice(0, 8)} · {formatDateTime(event.booking.startsAt)}
                          {' – '}{formatDateTime(event.booking.endsAt)}
                        </p>
                      ) : null}
                      {event.incidentId ? (
                        <p className="text-ink-muted mt-1 text-xs">
                          Incident {event.incidentId.slice(0, 8)}
                        </p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          </SectionCard>
          {hasMore ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <SectionCard>
          <EmptyState
            icon={History}
            title="No activity yet"
            description="Database-recorded activity in your permitted institution scope will appear here."
          />
        </SectionCard>
      )}
    </div>
  )
}
