'use client'

import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import { BookingStatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/format'
import type { Booking, Role } from '@/lib/types'

export function BookingList({
  bookings,
  role,
  renderActions,
  showRequester = false,
  resourceNameMap = {},
}: {
  bookings: Booking[]
  role: Role
  renderActions?: (booking: Booking) => React.ReactNode
  showRequester?: boolean
  resourceNameMap?: Record<string, string>
}) {
  return (
    <ul className="divide-line-muted divide-y">
      {bookings.map((b) => {
        const resourceName = resourceNameMap[b.resourceId] ?? 'Unknown resource'
        return (
          <li key={b.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
            <div className="bg-surface text-navy flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-md">
              <span className="text-[11px] leading-3 font-medium uppercase">
                {formatDate(b.date, { year: false }).split(' ')[1]}
              </span>
              <span className="text-lg leading-5 font-semibold">{formatDate(b.date, { year: false }).split(' ')[0]}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link
                  href={role === 'student' ? `/student/explore/${b.resourceId}` : `/owner/resources/${b.resourceId}`}
                  className="hover:text-teal truncate text-sm font-semibold"
                >
                  {resourceName}
                </Link>
                <BookingStatusBadge status={b.status} />
              </div>
              <p className="text-ink-muted mt-1 flex flex-wrap items-center gap-x-3 text-[13px]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  {formatDate(b.date, { weekday: true })}, {b.start}–{b.end}
                </span>
                <span>{b.id}</span>
                {showRequester ? <span>{b.requesterName}</span> : null}
              </p>
            </div>
            {renderActions ? <div className="flex shrink-0 flex-wrap gap-2">{renderActions(b)}</div> : null}
          </li>
        )
      })}
    </ul>
  )
}
