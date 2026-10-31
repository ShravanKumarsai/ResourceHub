import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  LayoutDashboard,
  LockKeyhole,
  PackageOpen,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { LogoutButton } from '@/components/auth/logout-actions'
import {
  MembershipReviewSection,
  type PendingApplicant,
} from '@/components/institution/membership-review-section'
import { updateInstitutionNameAction } from '@/app/institution/dashboard/actions'

interface Institution {
  id: string
  name: string
  slug: string
  is_active: boolean
}

interface InstitutionDashboardProps {
  institution: Institution
  email: string
  membershipCounts: { active: number; pending: number } | null
  resourceCount: number | null
  bookingCount: number | null
  openIncidentCount: number | null
  pendingApplicants: PendingApplicant[] | null
  applicantLoadError: boolean
}

const sections = [
  { href: '#overview', label: 'Overview', icon: LayoutDashboard },
  { href: '#resources', label: 'Resources', icon: PackageOpen },
  { href: '#bookings', label: 'Bookings', icon: CalendarDays },
  { href: '#memberships', label: 'Memberships', icon: UsersRound },
  { href: '#settings', label: 'Institution settings', icon: Settings2 },
]

function SidebarLinks({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav aria-label={mobile ? 'Dashboard sections' : 'Institution dashboard'} className="space-y-1">
      {sections.map(({ href, label, icon: Icon }, index) => (
        <a
          key={href}
          href={href}
          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            mobile
              ? index === 0
                ? 'bg-teal-soft text-teal'
                : 'text-ink-muted hover:bg-canvas hover:text-navy'
              : index === 0
                ? 'bg-white/12 text-white'
                : 'text-white/65 hover:bg-white/8 hover:text-white'
          }`}
        >
          <Icon className={`size-[18px] ${index === 0 ? 'text-teal-200' : ''}`} aria-hidden="true" />
          {label}
          {index === 0 ? <span className="ml-auto size-1.5 rounded-full bg-teal-300" /> : null}
        </a>
      ))}
    </nav>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
  unavailable = false,
}: {
  label: string
  value: string | number
  detail: string
  icon: typeof UsersRound
  accent?: boolean
  unavailable?: boolean
}) {
  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_-22px_rgba(16,37,56,0.5)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-ink-muted text-[13px] font-medium">{label}</p>
          <p className={`mt-3 text-3xl font-semibold tracking-tight ${unavailable ? 'text-ink-muted' : 'text-ink'}`}>
            {value}
          </p>
        </div>
        <span className={`flex size-10 items-center justify-center rounded-xl ${accent ? 'bg-teal-soft text-teal' : 'bg-surface text-navy'}`}>
          <Icon className="size-[19px]" aria-hidden="true" />
        </span>
      </div>
      <p className="text-ink-muted mt-3 text-xs leading-5">{detail}</p>
    </article>
  )
}

function NotConfiguredCard({
  title,
  detail,
  icon: Icon,
}: {
  title: string
  detail: string
  icon: typeof PackageOpen
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line bg-canvas/80 p-5 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-ink-muted shadow-sm">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          <span className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
            Not connected
          </span>
        </div>
        <p className="text-ink-muted mt-1 text-sm leading-6">{detail}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <LockKeyhole className="size-3.5" aria-hidden="true" />
        Setup required
      </span>
    </div>
  )
}

export function InstitutionDashboard({
  institution,
  email,
  membershipCounts,
  resourceCount,
  bookingCount,
  openIncidentCount,
  pendingApplicants,
  applicantLoadError,
}: InstitutionDashboardProps) {
  return (
    <div className="space-y-8">
      <section id="overview" className="scroll-mt-24">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">INSTITUTION ADMINISTRATION</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[38px] sm:leading-tight">
              Welcome to your workspace
            </h1>
            <p className="text-ink-muted mt-2 max-w-2xl text-sm leading-6 sm:text-[15px]">
              A clear view of your institution&apos;s ResourceHub access and the management areas available today.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-status-approved/20 bg-status-approved-bg px-3 py-2 text-xs font-semibold text-status-approved">
            <Check className="size-3.5" aria-hidden="true" />
            Administrator access verified
          </div>
        </div>

        <div className="mt-7 overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-[#1b5267] to-teal p-6 text-white shadow-[0_20px_50px_-36px_rgba(16,37,56,0.85)] sm:p-8">
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-white/65 uppercase">Institution overview</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[28px]">{institution.name}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                Your institution identity is connected. Resource and booking management will appear when their database workflows are available.
              </p>
            </div>
            <div className="flex size-16 shrink-0 items-center justify-center self-start rounded-2xl border border-white/20 bg-white/10 sm:size-[76px] sm:self-center">
              <Building2 className="size-8 text-white" strokeWidth={1.5} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/15 pt-5 text-xs text-white/75">
            <span className="inline-flex items-center gap-2">
              <BadgeCheck className="size-4 text-teal-200" aria-hidden="true" />
              Active institution
            </span>
            <span className="inline-flex items-center gap-2">
              <Building2 className="size-4 text-teal-200" aria-hidden="true" />
              {institution.slug}
            </span>
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="size-4 text-teal-200" aria-hidden="true" />
              Role verified on the server
            </span>
          </div>
        </div>

        {membershipCounts === null ? (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-status-pending/25 bg-status-pending-bg p-4 text-status-pending">
            <CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Membership totals could not be loaded</p>
              <p className="mt-1 text-xs leading-5">
                Your administrator access was verified, but the institution-scoped membership query failed. Refresh the page to try again.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active memberships"
            value={membershipCounts?.active ?? '—'}
            detail="Active accounts with an institutional membership."
            icon={UsersRound}
            accent
          />
          <MetricCard
            label="Pending requests"
            value={membershipCounts?.pending ?? '—'}
            detail={membershipCounts?.pending === 0 ? 'There are no requests awaiting review.' : 'Awaiting institutional review.'}
            icon={Clock3}
          />
          <MetricCard
            label="Resources"
            value={resourceCount === null ? '—' : resourceCount}
            detail={resourceCount === null ? 'Unable to load resource inventory.' : resourceCount === 0 ? 'No resource records in this institution yet.' : 'Resources published in the connected workspace.'}
            icon={PackageOpen}
            unavailable={resourceCount === null}
          />
          <MetricCard
            label="Bookings"
            value={bookingCount === null ? '—' : bookingCount}
            detail={bookingCount === null ? 'Unable to load booking activity.' : bookingCount === 0 ? 'No booking records yet.' : 'Booking records in the connected workspace.'}
            icon={CalendarDays}
            unavailable={bookingCount === null}
          />
        </div>
      </section>

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
        <div className="space-y-6">
          <section id="resources" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_-22px_rgba(16,37,56,0.5)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">RESOURCE MANAGEMENT</p>
                <h2 className="mt-1.5 text-lg font-semibold">Institution resources</h2>
              </div>
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-navy">
                <PackageOpen className="size-5" aria-hidden="true" />
              </span>
            </div>
            <NotConfiguredCard
              title="Resource inventory is not connected"
              detail="The deployed database currently contains identity and membership tables, but no resource, ownership, or availability tables. No demo resources are shown here."
              icon={PackageOpen}
            />
          </section>

          <section id="bookings" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_-22px_rgba(16,37,56,0.5)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">BOOKING MANAGEMENT</p>
                <h2 className="mt-1.5 text-lg font-semibold">Requests and schedules</h2>
              </div>
              <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-navy">
                <CalendarDays className="size-5" aria-hidden="true" />
              </span>
            </div>
            <NotConfiguredCard
              title="Booking workflows are not connected"
              detail="There are no booking, approval, or waitlist tables in the deployed schema. Booking actions are intentionally unavailable."
              icon={CalendarDays}
            />
          </section>

          <section id="memberships" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_-22px_rgba(16,37,56,0.5)] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">MEMBERSHIP MANAGEMENT</p>
                <h2 className="mt-1.5 text-lg font-semibold">Institution access</h2>
              </div>
              <Link href="/institution" className="text-teal hover:text-navy text-sm font-semibold">
                View directory
              </Link>
              <span className="flex size-10 items-center justify-center rounded-xl bg-teal-soft text-teal">
                <UsersRound className="size-5" aria-hidden="true" />
              </span>
            </div>
            {membershipCounts ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line-muted bg-canvas p-4">
                  <p className="text-ink-muted text-xs font-medium">Active memberships</p>
                  <p className="mt-2 text-2xl font-semibold">{membershipCounts.active}</p>
                  <p className="text-ink-muted mt-1 text-xs">In this institution</p>
                </div>
                <div className="rounded-xl border border-line-muted bg-canvas p-4">
                  <p className="text-ink-muted text-xs font-medium">Pending requests</p>
                  <p className="mt-2 text-2xl font-semibold">{membershipCounts.pending}</p>
                  <p className="text-ink-muted mt-1 text-xs">
                    {membershipCounts.pending === 0 ? 'No requests to review' : 'Awaiting review'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-line-muted bg-canvas p-4 text-sm text-ink-muted">
                Membership counts are temporarily unavailable. Please refresh to retry.
              </p>
            )}
            <div className="mt-5">
              <MembershipReviewSection applicants={pendingApplicants} loadError={applicantLoadError} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section id="settings" className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_-22px_rgba(16,37,56,0.5)] sm:p-6">
            <p className="eyebrow">INSTITUTION SETTINGS</p>
            <h2 className="mt-1.5 text-lg font-semibold">Institution profile</h2>
            <p className="text-ink-muted mt-1 text-sm leading-6">
              Keep the institution record aligned with the operational workspace used by students, owners and administrators.
            </p>

            <form action={updateInstitutionNameAction} className="mt-5 space-y-4">
              <div>
                <label htmlFor="institution-name" className="text-ink-muted mb-2 block text-xs font-medium uppercase tracking-[0.08em]">
                  Institution name
                </label>
                <input
                  id="institution-name"
                  name="name"
                  defaultValue={institution.name}
                  className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
                  maxLength={200}
                  required
                />
              </div>

              <div className="rounded-xl border border-line bg-canvas p-3">
                <p className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">Current identity</p>
                <div className="mt-2 grid gap-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink-muted">Slug</span>
                    <span className="font-mono text-ink">{institution.slug}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink-muted">Status</span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-status-approved">
                      <span className="size-1.5 rounded-full bg-status-approved" />
                      Active
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy/90"
              >
                Save institution name
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_-22px_rgba(16,37,56,0.5)] sm:p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-[18px] text-teal" aria-hidden="true" />
              <h2 className="text-base font-semibold">Access and privacy</h2>
            </div>
            <p className="text-ink-muted mt-2 text-sm leading-6">
              This dashboard uses your authenticated Supabase session and database membership. It does not trust a selected role or expose service credentials.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-canvas px-3 py-2 text-xs">
              <span className="text-ink-muted">Open incidents</span>
              <span className="font-semibold text-ink">{openIncidentCount === null ? '—' : openIncidentCount}</span>
            </div>
            <Link href="/auth/status" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-teal hover:underline">
              View account status <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </section>

          <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface/70 p-4">
            <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <p className="text-ink-muted text-xs leading-5">
              As database capabilities are reviewed and enabled, these sections can be connected without changing the existing demo workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
