import type { Metadata } from 'next'
import { InstitutionDashboard } from '@/components/institution/institution-dashboard'
import type { PendingApplicant } from '@/components/institution/membership-review-section'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import { logSupabaseError } from '@/lib/supabase/dev-error'

export const metadata: Metadata = { title: 'Institution dashboard' }

export default async function InstitutionDashboardPage() {
  const { supabase, user, institution } = await requireInstitutionAdmin()

  const [activeMemberships, pendingMemberships, resourceCountResult, bookingCountResult, incidentCountResult, pendingApplicantsResult] = await Promise.all([
    supabase
      .from('institution_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institution.id)
      .eq('status', 'active'),
    supabase
      .from('institution_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institution.id)
      .eq('status', 'pending'),
    supabase
      .from('resources')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institution.id),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institution.id),
    supabase
      .from('incidents')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institution.id)
      .neq('status', 'resolved'),
    supabase.rpc('list_pending_membership_applicants', {
      p_institution_id: institution.id,
    }),
  ])

  const membershipLoadError = Boolean(activeMemberships.error || pendingMemberships.error)
  if (pendingApplicantsResult.error) {
    logSupabaseError('Loading pending institution applicants failed', pendingApplicantsResult.error)
  }

  const resourceStat = resourceCountResult.error ? null : (resourceCountResult.count ?? 0)
  const bookingStat = bookingCountResult.error ? null : (bookingCountResult.count ?? 0)
  const incidentStat = incidentCountResult.error ? null : (incidentCountResult.count ?? 0)

  return (
    <InstitutionDashboard
      institution={institution}
      email={user.email ?? ''}
      membershipCounts={
        membershipLoadError
          ? null
          : {
              active: activeMemberships.count ?? 0,
              pending: pendingMemberships.count ?? 0,
            }
      }
      resourceCount={resourceStat}
      bookingCount={bookingStat}
      openIncidentCount={incidentStat}
      pendingApplicants={
        pendingApplicantsResult.error
          ? null
          : (pendingApplicantsResult.data ?? []) as PendingApplicant[]
      }
      applicantLoadError={Boolean(pendingApplicantsResult.error)}
    />
  )
}
