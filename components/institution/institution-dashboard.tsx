import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
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
import { InstitutionNameForm } from '@/components/institution/institution-name-form'
import { InstitutionOperations } from '@/components/institution/institution-operations'
import type {
  InstitutionBookingEntry,
  InstitutionResourceEntry,
} from '@/lib/institution/dashboard-queries'
import { DashboardQueryError } from '@/components/dashboard/dashboard-state'

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
  resources: InstitutionResourceEntry[]
  resourcesLoadError: boolean
  bookingCount: number | null
  bookings: InstitutionBookingEntry[]
  bookingsLoadError: boolean
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

export function InstitutionDashboard({
  institution,
  email,
  membershipCounts,
  resourceCount,
  resources,
  resourcesLoadError,
  bookingCount,
  bookings,
  bookingsLoadError,
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
                Review institution-scoped bookings and the resources visible to your account under the existing database permissions.
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
          <div className="mt-6">
            <DashboardQueryError
              title="Membership totals could not be loaded"
              description="Your administrator access was verified, but the institution-scoped membership query failed."
            />
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
          label="Accessible resources"
            value={resourceCount === null ? '—' : resourceCount}
          detail={resourceCount === null ? 'Unable to load resources visible under current access rules.' : resourceCount === 0 ? 'No resources are visible under current access rules.' : 'Listed resources and any resources you personally own.'}
            icon={PackageOpen}
            unavailable={resourceCount === null}
          />
          <MetricCard
            label="Bookings"
            value={bookingCount === null ? '—' : bookingCount}
            detail={bookingCount === null ? 'Unable to load institution booking activity.' : bookingCount === 0 ? 'No booking records yet.' : 'Read-only institution booking records.'}
            icon={CalendarDays}
            unavailable={bookingCount === null}
          />
        </div>
      </section>

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
        <div className="space-y-6">
          <InstitutionOperations
            resources={resources}
            resourceCount={resourceCount}
            resourcesLoadError={resourcesLoadError}
            bookings={bookings}
            bookingCount={bookingCount}
            bookingsLoadError={bookingsLoadError}
          />

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
                Membership counts are temporarily unavailable. Use the retry control above.
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

            <InstitutionNameForm key={institution.name} defaultName={institution.name} slug={institution.slug} />
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
            {openIncidentCount === null ? (
              <div className="mt-3">
                <DashboardQueryError title="Open incident count could not be loaded" />
              </div>
            ) : null}
            <Link href="/auth/status" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-teal hover:underline">
              View account status <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </section>

          <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface/70 p-4">
            <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
            <p className="text-ink-muted text-xs leading-5">
              Institution administrators can view authorized listings and booking records here. Existing database permissions do not grant administrators resource edits, booking decisions, or condition-report access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
