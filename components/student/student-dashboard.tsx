import Link from 'next/link'
import { ArrowRight, CalendarCheck, Clock, FlaskConical, Search, ShieldAlert } from 'lucide-react'
import { EmptyState, SectionCard } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { DashboardQueryError } from '@/components/dashboard/dashboard-state'
import { requireWorkspaceRole } from '@/lib/auth/workspace'
import { logSupabaseError } from '@/lib/supabase/dev-error'

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
  }).format(date)
}

export async function StudentDashboard() {
  const { supabase, user } = await requireWorkspaceRole('student')

  const [profileResult, bookingsResult, incidentsResult, resourcesResult] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('bookings')
      .select('id, status, starts_at, ends_at, purpose, resource_id, resources(name, location)')
      .eq('requester_user_id', user.id)
      .order('starts_at', { ascending: true }),
    supabase
      .from('incidents')
      .select('id, status, title, created_at')
      .eq('reporter_user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('resources')
      .select('id, name, category, location, availability, listed')
      .eq('listed', true)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  if (profileResult.error) logSupabaseError('Loading student dashboard profile failed', profileResult.error)
  if (bookingsResult.error) logSupabaseError('Loading student dashboard bookings failed', bookingsResult.error)
  if (incidentsResult.error) logSupabaseError('Loading student dashboard incidents failed', incidentsResult.error)
  if (resourcesResult.error) logSupabaseError('Loading student dashboard resources failed', resourcesResult.error)

  const profileName = profileResult.data?.display_name?.trim() || user.email?.split('@')[0] || 'Student'
  const bookings = bookingsResult.data ?? []
  const incidents = incidentsResult.data ?? []
  const now = new Date()
  const upcoming = bookings
    .filter((booking) => new Date(booking.starts_at) >= now)
    .filter((booking) => ['approved', 'pending', 'in_use'].includes(booking.status))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  const nextSession = upcoming.find((booking) => booking.status === 'approved' || booking.status === 'in_use')
  const pendingCount = bookings.filter((booking) => booking.status === 'pending').length
  const activeCount = bookings.filter((booking) => booking.status === 'in_use').length
  const openIncidents = incidents.filter((incident) => incident.status !== 'resolved').length

  const statCards = [
    { label: 'Upcoming sessions', value: bookingsResult.error ? '—' : upcoming.length, detail: bookingsResult.error ? 'Booking data is unavailable.' : 'Approved and pending', tone: 'bg-navy text-white' },
    { label: 'Awaiting approval', value: bookingsResult.error ? '—' : pendingCount, detail: bookingsResult.error ? 'Booking data is unavailable.' : 'Owner decisions pending', tone: 'bg-status-pending-bg text-status-pending' },
    { label: 'Currently in use', value: bookingsResult.error ? '—' : activeCount, detail: bookingsResult.error ? 'Booking data is unavailable.' : 'Checked out to you', tone: 'bg-status-approved-bg text-status-approved' },
    { label: 'Open incidents', value: incidentsResult.error ? '—' : openIncidents, detail: incidentsResult.error ? 'Incident data is unavailable.' : 'Reported by you', tone: 'bg-surface text-navy' },
  ]

  return (
    <div className="space-y-6">
      <div className="surface-panel overflow-hidden">
        <div className="bg-gradient-to-r from-navy via-[#1d4c63] to-[#1c7d87] p-6 text-white sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">Student workspace</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[34px]">Welcome back, {profileName}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                Your live bookings, approvals, and outstanding activity are all aligned with your current ResourceHub membership.
              </p>
            </div>
            <Link href="/student/explore" className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-navy shadow-sm transition-opacity hover:opacity-95">
              <Search />
              Explore resources
            </Link>
          </div>
        </div>
      </div>

      {profileResult.error ? (
        <DashboardQueryError title="Your profile could not be loaded" />
      ) : null}
      {bookingsResult.error ? (
        <DashboardQueryError title="Your bookings could not be loaded" />
      ) : null}
      {incidentsResult.error ? (
        <DashboardQueryError title="Your incident summary could not be loaded" />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <article key={card.label} className="surface-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</p>
              </div>
              <span className={`flex size-10 items-center justify-center rounded-xl ${card.tone}`}>
                {card.label.includes('Upcoming') ? <CalendarCheck className="size-4" /> : card.label.includes('approval') ? <Clock className="size-4" /> : card.label.includes('in use') ? <ShieldAlert className="size-4" /> : <FlaskConical className="size-4" />}
              </span>
            </div>
            <p className="text-ink-muted mt-2 text-xs">{card.detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <SectionCard title="Upcoming bookings" actions={<Link href="/student/bookings" className="text-teal text-[13px] font-medium hover:underline">View all</Link>}>
          {bookingsResult.error ? (
            <p className="text-ink-muted text-sm">Upcoming bookings are unavailable until the query succeeds.</p>
          ) : upcoming.length ? (
            <ul className="space-y-3">
              {upcoming.slice(0, 5).map((booking) => {
                const resource = booking.resources as { name?: string; location?: string } | null
                return (
                  <li key={booking.id} className="border-line-muted flex items-start justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0">
                    <div>
                      <p className="font-medium">{resource?.name ?? 'Resource'}</p>
                      <p className="text-ink-muted text-sm">{resource?.location ?? 'Location unavailable'}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{formatDateOnly(booking.starts_at)}</p>
                      <p className="text-ink-muted">{formatDateTime(booking.starts_at)} to {formatDateTime(booking.ends_at)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState icon={CalendarCheck} title="No upcoming bookings" description="Your booked sessions will appear here when they are submitted and approved." action={<Link href="/student/explore" className={buttonVariants()}>Explore resources</Link>} />
          )}
        </SectionCard>

        <div className="space-y-6">
          {nextSession ? (
            <section className="rounded-xl bg-navy p-5 text-white">
              <p className="text-xs font-semibold tracking-[0.08em] text-white/70 uppercase">{nextSession.status === 'in_use' ? 'In use' : 'Next session'}</p>
              <h2 className="mt-2 text-lg font-semibold text-white">{(nextSession.resources as { name?: string } | null)?.name ?? 'Resource'}</h2>
              <p className="mt-1 text-sm text-white/80">{formatDateOnly(nextSession.starts_at)}, {formatDateTime(nextSession.starts_at)}–{formatDateTime(nextSession.ends_at)}</p>
              <Link href="/student/bookings" className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-navy hover:bg-white/90">
                View booking
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </section>
          ) : null}

          <SectionCard title="Quick actions" bodyClassName="grid gap-2">
            {[
              { href: '/student/explore', label: 'Find a resource' },
              { href: '/student/handover', label: 'Check in or check out' },
              { href: '/student/incidents', label: 'Report an incident' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="border-line hover:bg-surface flex h-11 items-center justify-between rounded-lg border px-4 text-sm font-medium">
                {item.label}
                <ArrowRight className="text-ink-muted size-4" aria-hidden="true" />
              </Link>
            ))}
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Available to book">
        {resourcesResult.error ? (
          <DashboardQueryError title="Available resources could not be loaded" />
        ) : resourcesResult.data && resourcesResult.data.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {resourcesResult.data.map((resource) => (
              <div key={resource.id} className="rounded-lg border border-line bg-surface p-4">
                <p className="text-ink-muted text-xs uppercase tracking-[0.08em]">{resource.category}</p>
                <h3 className="mt-2 text-base font-semibold">{resource.name}</h3>
                <p className="text-ink-muted mt-1 text-sm">{resource.location}</p>
                <p className="mt-2 inline-flex rounded-full bg-status-approved-bg px-2 py-1 text-[11px] font-medium text-status-approved">{resource.availability}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-muted text-sm">No public resource listings are currently visible to students.</p>
        )}
      </SectionCard>
    </div>
  )
}
