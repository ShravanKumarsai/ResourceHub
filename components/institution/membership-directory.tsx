import Link from 'next/link'
import { ArrowLeft, Mail, UsersRound } from 'lucide-react'

export interface InstitutionMembershipDirectoryEntry {
  membership_id: string
  applicant_name: string | null
  applicant_email: string | null
  requested_role: string | null
  approved_roles: string[]
  status: string
  requested_at: string
  reviewed_at: string | null
}

function roleLabel(role: string) {
  if (role === 'student') return 'Student / Researcher'
  if (role === 'resource_owner') return 'Resource Manager'
  if (role === 'institution_admin') return 'Institution Administrator'
  return role
}

function dateLabel(value: string) {
  return `${new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })} UTC`
}

export function MembershipDirectory({
  institutionName,
  entries,
  loadError,
}: {
  institutionName: string
  entries: InstitutionMembershipDirectoryEntry[] | null
  loadError: boolean
}) {
  return (
    <main className="container-page min-h-dvh max-w-5xl py-8 sm:py-12">
      <Link
        href="/institution/dashboard"
        className="text-ink-muted hover:text-navy inline-flex items-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Institution dashboard
      </Link>

      <header className="mt-7">
        <p className="eyebrow">INSTITUTION ADMINISTRATION</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-teal-soft text-teal">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Membership directory
            </h1>
            <p className="text-ink-muted mt-1 text-sm">{institutionName}</p>
          </div>
        </div>
        <p className="text-ink-muted mt-4 max-w-2xl text-sm leading-6">
          Membership details are available only to active administrators of this institution.
          Applicant email addresses are returned by a restricted institution-scoped database function.
        </p>
      </header>

      {loadError || entries === null ? (
        <section
          role="alert"
          className="mt-7 rounded-xl border border-status-pending/25 bg-status-pending-bg p-5"
        >
          <h2 className="text-sm font-semibold text-status-pending">
            Membership information could not be loaded
          </h2>
          <p className="text-ink-muted mt-1 text-sm">
            Refresh to retry. No broader profile or Auth-user access was enabled.
          </p>
        </section>
      ) : entries.length === 0 ? (
        <section className="mt-7 rounded-xl border border-dashed border-line p-8 text-center">
          <h2 className="font-semibold">No membership records yet</h2>
          <p className="text-ink-muted mt-1 text-sm">
            Requests and approved members for this institution will appear here.
          </p>
        </section>
      ) : (
        <ul className="mt-7 space-y-3">
          {entries.map((entry) => {
            const roles =
              entry.status === 'active'
                ? entry.approved_roles.map(roleLabel)
                : entry.requested_role
                  ? [roleLabel(entry.requested_role)]
                  : []

            return (
              <li
                key={entry.membership_id}
                className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">
                      {entry.applicant_name?.trim() || 'Name not provided'}
                    </h2>
                    <p className="text-ink-muted mt-1 flex min-w-0 items-center gap-1.5 break-all text-sm">
                      <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                      {entry.applicant_email || 'Email unavailable'}
                    </p>
                    <p className="text-ink-muted mt-2 text-sm">
                      {entry.status === 'active' ? 'Approved role' : 'Requested role'}:
                      {' '}{roles.join(', ') || 'Not recorded for this legacy request'}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-surface px-3 py-1 text-xs font-semibold capitalize text-navy">
                    {entry.status}
                  </span>
                </div>
                <p className="text-ink-muted mt-3 text-xs">
                  Requested {dateLabel(entry.requested_at)}
                  {entry.reviewed_at ? ` · Reviewed ${dateLabel(entry.reviewed_at)}` : ''}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
