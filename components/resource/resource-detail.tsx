'use client'

import Link from 'next/link'
import { ArrowLeft, ChevronRight, MapPin, ShieldAlert, UserRound } from 'lucide-react'
import { EmptyState, SectionCard } from '@/components/page-header'
import { ResourceImage } from '@/components/resource/resource-image'
import { AvailabilityBadge } from '@/components/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { BookingPanel, PublicBookingCard } from '@/components/resource/booking-panel'
import { formatPrice } from '@/lib/format'
import type { Resource } from '@/lib/types'
import { PackageSearch } from 'lucide-react'

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5 text-sm leading-6">
      {items.map((t) => (
        <li key={t} className="flex gap-3">
          <span className="bg-teal mt-2.5 size-1.5 shrink-0 rounded-full" aria-hidden="true" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

export function ResourceDetail({
  resource,
  mode,
  listHref,
  listLabel,
  bookingsHref,
  embedded = false,
}: {
  resource: Resource | null
  mode: 'public' | 'student'
  listHref: string
  listLabel: string
  bookingsHref?: string
  embedded?: boolean
}) {
  if (!resource) {
    return (
      <div className={embedded ? '' : 'container-page py-16'}>
        <EmptyState
          icon={PackageSearch}
          title="Resource not found"
          description="This resource may have been removed or is no longer listed."
          action={
            <Link href={listHref} className={buttonVariants({ variant: 'outline' })}>
              <ArrowLeft />
              Back to {listLabel.toLowerCase()}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className={embedded ? '' : 'container-page py-8 lg:py-10'}>
      <nav aria-label="Breadcrumb" className="text-ink-muted mb-5 flex items-center gap-1.5 text-[13px]">
        <Link href={listHref} className="hover:text-navy hover:underline">
          {listLabel}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="text-ink truncate" aria-current="page">
          {resource.name}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <div>
            <p className="eyebrow">{resource.category}</p>
            <h1 className="mt-1.5 text-3xl leading-tight font-semibold text-balance">{resource.name}</h1>
            <div className="text-ink-muted mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <AvailabilityBadge availability={resource.availability} />
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" />
                {resource.institution} · {resource.location}
              </span>
              <span className="flex items-center gap-1.5">
                <UserRound className="size-4" aria-hidden="true" />
                {resource.ownerName}
              </span>
            </div>
          </div>

          <div className="border-line bg-surface relative aspect-[16/9] overflow-hidden rounded-xl border">
            <ResourceImage
              src={resource.image}
              alt={`${resource.name} at ${resource.institution}`}
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover"
            />
          </div>

          <SectionCard title="Overview">
            <p className="text-[15px] leading-7 text-pretty">{resource.description}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {resource.highlights.map((h) => (
                <li key={h} className="bg-canvas flex gap-3 rounded-lg px-3.5 py-3 text-sm leading-5">
                  <span className="bg-teal mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden="true" />
                  {h}
                </li>
              ))}
            </ul>
          </SectionCard>

          {resource.specs.length ? (
            <SectionCard title="Specifications">
              <dl className="divide-line-muted divide-y text-sm">
                {resource.specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-[140px_1fr] gap-4 py-3 first:pt-0 last:pb-0 sm:grid-cols-[200px_1fr]">
                    <dt className="text-ink-muted">{s.label}</dt>
                    <dd className="font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Who can book">
              <BulletList items={resource.eligibility} />
            </SectionCard>
            <SectionCard title="Required training">
              <BulletList items={resource.training} />
            </SectionCard>
          </div>

          <SectionCard title="Safety requirements">
            <div className="bg-status-pending-bg text-status-pending mb-4 flex gap-2.5 rounded-lg p-3 text-[13px] leading-5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Review these requirements before requesting a booking. Owners may decline requests that
              do not meet them.
            </div>
            <BulletList items={resource.safety} />
          </SectionCard>

          <div className="grid gap-6 md:grid-cols-2">
            <SectionCard title="Suitable for">
              <BulletList items={resource.useCases} />
            </SectionCard>
            <SectionCard title="Usage instructions">
              <ol className="space-y-3 text-sm leading-6">
                {resource.instructions.map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="bg-surface text-navy flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24" aria-label="Booking">
          {mode === 'student' ? (
            <BookingPanel resource={resource} bookingsHref={bookingsHref ?? '/student/bookings'} />
          ) : (
            <PublicBookingCard resource={resource} />
          )}

          <div className="border-line rounded-xl border bg-white p-5">
            <p className="text-ink-muted mt-3 text-xs">
              {formatPrice(resource.hourlyRate)} · Maximum {resource.maxDurationHours} hours per session
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
