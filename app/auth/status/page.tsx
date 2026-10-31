import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-actions'
import { MembershipRequestForm } from '@/components/auth/membership-request-form'
import { buttonVariants } from '@/components/ui/button'
import { requireAuthenticatedUser } from '@/lib/auth/server'

export const metadata: Metadata = { title: 'Account status' }

interface MembershipRecord {
  id: string
  institution_id: string
  status: string
  requested_role: string | null
  requested_at: string
  reviewed_at: string | null
  institution_membership_roles: { role: string }[]
}

interface InstitutionRecord {
  id: string
  name: string
}

export default async function AccountStatusPage({
  searchParams,
}: {
  searchParams: Promise<{
    institution_access?: string
    setup?: string
    setup_error?: string
    workspace?: string
  }>
}) {
  const [{ supabase, user }, params] = await Promise.all([
    requireAuthenticatedUser(),
    searchParams,
  ])

  const { data: adminMemberships, error: adminMembershipsError } = await supabase
    .from('institution_memberships')
    .select(
      'institution_id, institutions!inner(is_active), institution_membership_roles!inner(role)',
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('institutions.is_active', true)
    .eq('institution_membership_roles.role', 'institution_admin')
    .limit(1)

  if (adminMembershipsError) throw adminMembershipsError
  if (adminMemberships?.length) {
    redirect('/institution/dashboard')
  }

  const [{ data: profile, error: profileError }, { data: memberships, error: membershipsError }] =
    await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
      supabase
        .from('institution_memberships')
        .select(
          'id, institution_id, status, requested_role, requested_at, reviewed_at, institution_membership_roles(role)',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

  if (profileError) throw profileError
  if (membershipsError) throw membershipsError

  const membershipRecords = (memberships ?? []) as unknown as MembershipRecord[]
  const institutionIds = [...new Set(membershipRecords.map((membership) => membership.institution_id))]
  let institutionNames = new Map<string, string>()

  if (institutionIds.length > 0) {
    const { data, error } = await supabase
      .from('institutions')
      .select('id, name')
      .in('id', institutionIds)

    if (error) throw error
    institutionNames = new Map(
      ((data ?? []) as InstitutionRecord[]).map((institution) => [institution.id, institution.name]),
    )
  }

  const setupMessage =
    params.institution_access === 'denied'
      ? 'Institutional access requires an active institution administrator membership. Your login selection cannot grant that role.'
      : params.setup_error === 'membership'
      ? 'Your account was created, but the membership request could not be completed. Submit it below or contact an administrator.'
      : params.setup_error === 'profile'
        ? 'Your account profile is not available yet. Contact a ResourceHub administrator; no existing account was imported or modified.'
        : params.setup_error === 'institution'
          ? 'The selected institution is no longer active. Choose an active institution below.'
          : params.setup_error === 'request_role'
            ? 'Choose whether you are applying as a Student / Researcher or Resource Manager.'
          : null

  return (
    <div className="border-line w-full max-w-2xl rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold">Your ResourceHub account</h1>
      <p className="text-ink-muted mt-1.5 text-sm leading-6">
        Signed in as <span className="font-medium text-ink">{user.email}</span>
        {profile?.display_name ? ` (${profile.display_name})` : ''}.
      </p>

      {setupMessage ? (
        <p role="alert" className="text-status-rejected bg-status-rejected-bg mt-5 rounded-lg px-3 py-2 text-[13px]">
          {setupMessage}
        </p>
      ) : null}

      {membershipRecords.length > 0 ? (
        <section className="mt-6 space-y-3" aria-labelledby="membership-heading">
          <h2 id="membership-heading" className="text-base font-semibold">
            Institution membership
          </h2>
          <ul className="divide-line divide-y rounded-lg border">
            {membershipRecords.map((membership) => {
              const roleNames = membership.institution_membership_roles.map((role) =>
                role.role === 'resource_owner'
                  ? 'Resource Manager'
                  : role.role === 'institution_admin'
                    ? 'Institution Administrator'
                    : 'Student / Researcher',
              )
              const requestedRoleName =
                membership.requested_role === 'resource_owner'
                  ? 'Resource Manager'
                  : membership.requested_role === 'student'
                    ? 'Student / Researcher'
                    : null

              return (
                <li key={membership.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {institutionNames.get(membership.institution_id) ?? 'Institution'}
                    </span>
                    <span className="text-ink-muted capitalize">{membership.status}</span>
                  </div>
                  <p className="text-ink-muted mt-1 text-xs">
                    {membership.status === 'active'
                      ? `Approved role${roleNames.length === 1 ? '' : 's'}: ${roleNames.join(', ') || 'None'}`
                      : `Requested role: ${requestedRoleName ?? 'Not recorded for this legacy request'}`}
                  </p>
                  <p className="text-ink-muted mt-1 text-xs">
                    Requested {new Date(membership.requested_at).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
                    {membership.reviewed_at
                      ? ` · Reviewed ${new Date(membership.reviewed_at).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC`
                      : ''}
                  </p>
                  {membership.status === 'active' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {membership.institution_membership_roles.some(
                        (role) => role.role === 'student',
                      ) ? (
                        <Link href="/student/dashboard" className={buttonVariants({ size: 'sm' })}>
                          Student workspace
                        </Link>
                      ) : null}
                      {membership.institution_membership_roles.some(
                        (role) => role.role === 'resource_owner',
                      ) ? (
                        <Link href="/owner/dashboard" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                          Resource Manager workspace
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {membershipRecords.some((membership) => membership.status === 'pending') ? (
            <p role="status" className="text-status-pending text-sm">
              Your request is pending. You cannot enter the requested workspace until an institution administrator approves it.
            </p>
          ) : null}
          {membershipRecords.some((membership) => membership.status === 'rejected') ? (
            <p role="status" className="text-status-rejected text-sm">
              A membership request was rejected. Contact that institution’s administrator if you need more information.
            </p>
          ) : null}
        </section>
      ) : profile ? (
        <section className="mt-6 space-y-3 rounded-lg bg-surface p-4">
          <h2 className="font-semibold">Request institution membership</h2>
          <p className="text-ink-muted text-sm leading-6">
            Choose an active institution. Your request will be pending until an administrator reviews it and assigns appropriate roles.
          </p>
          <MembershipRequestForm />
        </section>
      ) : (
        <p className="text-ink-muted mt-6 text-sm">
          This Auth account has no application profile. Existing Auth users are not automatically imported or backfilled.
        </p>
      )}

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-semibold">Operational data status</h2>
        <p className="text-ink-muted mt-1 text-sm leading-6">
          Membership status and roles are read from Supabase. Resource, booking, and incident records are fetched through the authenticated workspace when the institution has operational data connected to your account.
        </p>
      </section>

      <div className="mt-6">
        <LogoutButton />
      </div>
    </div>
  )
}
