'use client'

import { useState } from 'react'
import { CalendarDays, PackageOpen, Search } from 'lucide-react'
import { DashboardQueryError } from '@/components/dashboard/dashboard-state'
import type {
  InstitutionBookingEntry,
  InstitutionResourceEntry,
} from '@/lib/institution/dashboard-queries'

const BOOKING_STATUSES = ['pending', 'approved', 'in_use', 'completed', 'rejected', 'cancelled']
const RESOURCE_AVAILABILITY = ['available', 'limited', 'unavailable']

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ')
}

function ResourceAdministration({
  resources,
  resourceCount,
  loadError,
}: {
  resources: InstitutionResourceEntry[]
  resourceCount: number | null
  loadError: boolean
}) {
  const [search, setSearch] = useState('')
  const [availability, setAvailability] = useState('all')
  const [visibility, setVisibility] = useState('all')
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filtered = resources.filter((resource) => {
    const matchesSearch = [
      resource.name,
      resource.category,
      resource.location,
      resource.owner_name,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    return (
      matchesSearch &&
      (availability === 'all' || resource.availability === availability) &&
      (visibility === 'all' ||
        (visibility === 'listed' ? resource.listed : !resource.listed))
    )
  })

  return (
    <section id="resources" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_-22px_rgba(16,37,56,0.5)] sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">RESOURCE MANAGEMENT</p>
          <h2 className="mt-1.5 text-lg font-semibold">Institution resources</h2>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-navy">
          <PackageOpen className="size-5" aria-hidden="true" />
        </span>
      </header>

      <p className="text-ink-muted mb-4 text-xs leading-5">
        Read-only records visible under the existing resource policy: public listings and any resources you personally own. The list is limited to the latest 200 and is not a complete private inventory.
      </p>
      {loadError ? (
        <DashboardQueryError title="Institution resources could not be loaded" />
      ) : resources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          No resources are visible to your account under the current access policy.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="relative block">
              <span className="sr-only">Search institution resources</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search resources or owners"
                className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal"
              />
            </label>
            <label className="sr-only" htmlFor="institution-resource-availability">Filter by availability</label>
            <select
              id="institution-resource-availability"
              value={availability}
              onChange={(event) => setAvailability(event.target.value)}
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <option value="all">All availability</option>
              {RESOURCE_AVAILABILITY.map((status) => (
                <option key={status} value={status}>{formatStatus(status)}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="institution-resource-visibility">Filter by listing visibility</label>
            <select
              id="institution-resource-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <option value="all">All visible records</option>
              <option value="listed">Listed</option>
              <option value="unlisted">Unlisted (own only)</option>
            </select>
          </div>
          <p className="text-ink-muted mt-3 text-xs" aria-live="polite">
            Showing {filtered.length} of {resources.length} loaded resources
            {resourceCount !== null ? ` (${resourceCount} accessible in total)` : ''}.
          </p>

          {filtered.length ? (
            <ul className="mt-4 space-y-3">
              {filtered.map((resource) => (
                <li key={resource.id} className="rounded-xl border border-line bg-canvas/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-ink-muted text-xs">{resource.category} · {resource.location}</p>
                      <h3 className="mt-1 font-semibold text-navy">{resource.name}</h3>
                      <p className="text-ink-muted mt-1 text-xs">Owner: {resource.owner_name || 'Not recorded'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="rounded-full bg-white px-2.5 py-1 capitalize text-navy">{resource.availability}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-navy">{resource.listed ? 'Listed' : 'Unlisted'}</span>
                    </div>
                  </div>
                  <details className="mt-3 border-t border-line pt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-teal">View authorized resource details</summary>
                    <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="text-ink-muted">Description</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-ink">{resource.description}</dd>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <dt className="text-ink-muted">Hourly rate</dt>
                          <dd className="mt-1 text-ink">{Number(resource.hourly_rate).toFixed(2)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Maximum booking duration</dt>
                          <dd className="mt-1 text-ink">{resource.max_duration_hours} hours</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Approval mode</dt>
                          <dd className="mt-1 text-ink">{resource.approval_mode === 'automatic' ? 'Automatic' : 'Owner review'}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-muted">Created</dt>
                          <dd className="mt-1 text-ink">{formatDateTime(resource.created_at)}</dd>
                        </div>
                      </div>
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg bg-canvas p-4 text-sm text-ink-muted">No resources match these filters.</p>
          )}
        </>
      )}
    </section>
  )
}

function BookingAdministration({
  bookings,
  bookingCount,
  loadError,
}: {
  bookings: InstitutionBookingEntry[]
  bookingCount: number | null
  loadError: boolean
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filtered = bookings.filter((booking) => {
    const matchesSearch = [
      booking.resource_name ?? '',
      booking.owner_name ?? '',
      booking.purpose,
      booking.id,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
    return matchesSearch && (status === 'all' || booking.status === status)
  })

  return (
    <section id="bookings" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_-22px_rgba(16,37,56,0.5)] sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">BOOKING MANAGEMENT</p>
          <h2 className="mt-1.5 text-lg font-semibold">Requests and schedules</h2>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-navy">
          <CalendarDays className="size-5" aria-hidden="true" />
        </span>
      </header>

      <p className="text-ink-muted mb-4 text-xs leading-5">
        Read-only booking records are scoped to this institution. Booking condition reports and other participant-only details are not shown to administrators.
      </p>
      {loadError ? (
        <DashboardQueryError title="Institution bookings could not be loaded" />
      ) : bookings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          No booking records are available in this institution.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <label className="relative block">
              <span className="sr-only">Search institution bookings</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search resource, owner or purpose"
                className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal"
              />
            </label>
            <label className="sr-only" htmlFor="institution-booking-status">Filter by booking status</label>
            <select
              id="institution-booking-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <option value="all">All booking statuses</option>
              {BOOKING_STATUSES.map((bookingStatus) => (
                <option key={bookingStatus} value={bookingStatus}>{formatStatus(bookingStatus)}</option>
              ))}
            </select>
          </div>
          <p className="text-ink-muted mt-3 text-xs" aria-live="polite">
            Showing {filtered.length} of {bookings.length} loaded bookings
            {bookingCount !== null ? ` (${bookingCount} in total)` : ''}. The list is limited to the latest 200 records.
          </p>

          {filtered.length ? (
            <ul className="mt-4 space-y-3">
              {filtered.map((booking) => (
                <li key={booking.id} className="rounded-xl border border-line bg-canvas/60 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-navy">{booking.resource_name ?? 'Resource details are not visible'}</h3>
                      <p className="text-ink-muted mt-1 text-xs">Owner: {booking.owner_name ?? 'Not available under current resource access'}</p>
                      <p className="text-ink-muted mt-1 text-xs">{formatDateTime(booking.starts_at)} – {formatDateTime(booking.ends_at)}</p>
                    </div>
                    <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-navy">
                      {formatStatus(booking.status)}
                    </span>
                  </div>
                  <details className="mt-3 border-t border-line pt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-teal">View booking details</summary>
                    <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="text-ink-muted">Purpose</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-ink">{booking.purpose}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted">Booking ID</dt>
                        <dd className="mt-1 break-all font-mono text-ink">{booking.id}</dd>
                      </div>
                      {booking.decision_note ? (
                        <div className="sm:col-span-2">
                          <dt className="text-ink-muted">Decision note</dt>
                          <dd className="mt-1 whitespace-pre-wrap text-ink">{booking.decision_note}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg bg-canvas p-4 text-sm text-ink-muted">No bookings match these filters.</p>
          )}
        </>
      )}
    </section>
  )
}

export function InstitutionOperations({
  resources,
  resourceCount,
  resourcesLoadError,
  bookings,
  bookingCount,
  bookingsLoadError,
}: {
  resources: InstitutionResourceEntry[]
  resourceCount: number | null
  resourcesLoadError: boolean
  bookings: InstitutionBookingEntry[]
  bookingCount: number | null
  bookingsLoadError: boolean
}) {
  return (
    <>
      <ResourceAdministration
        resources={resources}
        resourceCount={resourceCount}
        loadError={resourcesLoadError}
      />
      <BookingAdministration
        bookings={bookings}
        bookingCount={bookingCount}
        loadError={bookingsLoadError}
      />
    </>
  )
}
