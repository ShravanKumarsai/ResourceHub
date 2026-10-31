import Link from 'next/link'
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardList, Layers, ShieldAlert } from 'lucide-react'
import { EmptyState, SectionCard } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import { requireWorkspaceRole } from '@/lib/auth/workspace'

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export async function OwnerDashboard() {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')

  const [profileResult, resourcesResult, bookingsResult, incidentsResult] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('resources')
      .select('id, name, listed, availability, owner_user_id, created_at')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('bookings')
      .select('id, status, starts_at, ends_at, purpose, requester_user_id, resource_id, resources(name)')
      .in(
        'resource_id',
        (await supabase
          .from('resources')
          .select('id')
          .eq('owner_user_id', user.id)
          .then((result) => (result.data ?? []).map((row) => row.id))) ?? [],
      )
      .order('starts_at', { ascending: true }),
    supabase
      .from('incidents')
      .select('id, status, severity, title, resource_id, resources(name)')
      .in(
        'resource_id',
        (await supabase
          .from('resources')
          .select('id')
          .eq('owner_user_id', user.id)
          .then((result) => (result.data ?? []).map((row) => row.id))) ?? [],
      )
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const profileName =
    profileResult.data?.display_name?.trim() ||
    user.user_metadata?.full_name?.trim() ||
    user.user_metadata?.display_name?.trim() ||
    user.user_metadata?.name?.trim() ||
    'Resource owner'
  const resources = resourcesResult.data ?? []
  const bookings = bookingsResult.data ?? []
  const incidents = incidentsResult.data ?? []
  const pendingRequests = bookings.filter((booking) => booking.status === 'pending')
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const sessionsToday = bookings.filter((booking) => {
    const startsAt = new Date(booking.starts_at)
    return (booking.status === 'approved' || booking.status === 'in_use') && startsAt >= startOfToday && startsAt < endOfToday
  })
  const openIncidents = incidents.filter((incident) => incident.status !== 'resolved')

  const statCards = [
    {
      label: 'Pending requests',
      value: bookingsResult.error ? '—' : pendingRequests.length,
      detail: bookingsResult.error ? 'Live booking data is unavailable.' : pendingRequests.length ? 'Awaiting your decision' : 'No requests waiting on you',
      tone: 'bg-status-pending-bg text-status-pending',
      icon: CalendarClock,
    },
    {
      label: 'Sessions today',
      value: bookingsResult.error ? '—' : sessionsToday.length,
      detail: bookingsResult.error ? 'Unable to load sessions today.' : sessionsToday.length ? 'Approved or in use' : 'No sessions scheduled today',
      tone: 'bg-status-approved-bg text-status-approved',
      icon: ClipboardList,
    },
    {
      label: 'Listed resources',
      value: resourcesResult.error ? '—' : resources.filter((resource) => resource.listed).length,
      detail: resourcesResult.error ? 'Unable to load resource inventory.' : 'Visible to students',
      tone: 'bg-navy text-white',
      icon: Layers,
    },
    {
      label: 'Open incidents',
      value: incidentsResult.error ? '—' : openIncidents.length,
      detail: incidentsResult.error ? 'Incident feed is unavailable.' : openIncidents.length ? 'Need review' : 'No open incidents',
      tone: 'bg-surface text-navy',
      icon: ShieldAlert,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="surface-panel overflow-hidden">
        <div className="flex flex-col gap-5 border border-line bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Resource owner dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-navy sm:text-[34px]">Overview</h1>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              {profileName} — review approvals, incidents, and live availability across your resources.
            </p>
          </div>
          <Link href="/owner/resources/new" className={buttonVariants({ size: 'default' })}>
            <ClipboardList className="size-4" aria-hidden="true" />
            Add resource
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <article key={card.label} className="surface-panel flex h-full flex-col justify-between p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-navy">{card.value}</p>
                </div>
                <span className={`flex size-10 items-center justify-center rounded-xl ${card.tone}`}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </div>
              <p className="text-ink-muted mt-3 text-xs">{card.detail}</p>
            </article>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Requests awaiting approval"
          actions={
            <Link href="/owner/requests" className="text-[13px] font-medium text-teal hover:underline">
              Review all
            </Link>
          }
        >
          {pendingRequests.length ? (
            <ul className="space-y-3">
              {pendingRequests.slice(0, 4).map((booking) => (
                <li key={booking.id} className="border-line-muted flex items-start justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium text-navy">{((booking.resources as { name?: string } | null)?.name) ?? 'Resource'}</p>
                    <p className="text-ink-muted mt-1 text-sm">{booking.purpose}</p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="font-medium text-navy">{formatDateTime(booking.starts_at)}</p>
                    <p className="text-ink-muted capitalize">{booking.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No pending requests"
              description="All booking requests have been reviewed. New approvals will appear here automatically."
              action={<Link href="/owner/requests" className={buttonVariants()}>View requests</Link>}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Incidents needing attention"
          actions={
            <Link href="/owner/incidents" className="text-[13px] font-medium text-teal hover:underline">
              Manage
            </Link>
          }
        >
          {openIncidents.length ? (
            <ul className="space-y-3">
              {openIncidents.slice(0, 3).map((incident) => (
                <li key={incident.id} className="border-line-muted border-b pb-3 last:border-b-0 last:pb-0">
                  <p className="text-sm font-semibold text-navy">{incident.title}</p>
                  <p className="text-ink-muted mt-1 text-xs">{((incident.resources as { name?: string } | null)?.name) ?? 'Resource'}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                    <span>{incident.severity}</span>
                    <span>•</span>
                    <span>{incident.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title="No open incidents"
              description="Everything is currently clear across your managed resources."
              action={<Link href="/owner/incidents" className={buttonVariants({ variant: 'outline' })}>Open incident log</Link>}
            />
          )}
          <Link href="/owner/incidents" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-teal hover:underline">
            Open incident management <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </SectionCard>
      </div>

      <SectionCard title="Resource overview" description="Published and draft resources currently under your ownership">
        {resources.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resources.map((resource) => (
              <div key={resource.id} className="rounded-xl border border-line bg-surface/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{resource.availability}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-navy">
                    {resource.listed ? 'Listed' : 'Draft'}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-navy">{resource.name}</h3>
                <p className="text-ink-muted mt-1 text-sm">{resource.listed ? 'Visible to students and bookable' : 'Saved for later publication'}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Layers}
            title="No resources yet"
            description="Add your first resource to make it discoverable and bookable."
            action={<Link href="/owner/resources/new" className={buttonVariants()}>Add resource</Link>}
          />
        )}
      </SectionCard>
    </div>
  )
}
