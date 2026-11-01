import 'server-only'
import type { PendingApplicant } from '@/components/institution/membership-review-section'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import { logSupabaseError } from '@/lib/supabase/dev-error'

export interface InstitutionResourceEntry {
  id: string
  name: string
  category: string
  location: string
  description: string
  owner_name: string
  listed: boolean
  availability: string
  hourly_rate: number
  max_duration_hours: number
  approval_mode: string
  created_at: string
}

export interface InstitutionBookingEntry {
  id: string
  resource_id: string
  starts_at: string
  ends_at: string
  purpose: string
  status: string
  decision_note: string | null
  created_at: string
  resource_name: string | null
  owner_name: string | null
}

export async function getInstitutionDashboardData() {
  const { supabase, user, institution } = await requireInstitutionAdmin()

  const [
    activeMemberships,
    pendingMemberships,
    resourcesResult,
    bookingsResult,
    incidentCountResult,
    pendingApplicantsResult,
  ] = await Promise.all([
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
      .select(
        'id, name, category, location, description, owner_name, listed, availability, hourly_rate, max_duration_hours, approval_mode, created_at',
        { count: 'exact' },
      )
      .eq('institution_id', institution.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('bookings')
      .select(
        'id, resource_id, starts_at, ends_at, purpose, status, decision_note, created_at, resources(name, owner_name)',
        { count: 'exact' },
      )
      .eq('institution_id', institution.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('incidents')
      .select('id', { count: 'exact', head: true })
      .eq('institution_id', institution.id)
      .neq('status', 'resolved'),
    supabase.rpc('list_pending_membership_applicants', {
      p_institution_id: institution.id,
    }),
  ])

  if (activeMemberships.error || pendingMemberships.error) {
    logSupabaseError(
      'Loading institution membership counts failed',
      activeMemberships.error ?? pendingMemberships.error!,
    )
  }
  if (resourcesResult.error) {
    logSupabaseError('Loading institution resource inventory failed', resourcesResult.error)
  }
  if (bookingsResult.error) {
    logSupabaseError('Loading institution bookings failed', bookingsResult.error)
  }
  if (incidentCountResult.error) {
    logSupabaseError('Loading institution incident count failed', incidentCountResult.error)
  }
  const unexpectedApplicantRole = (pendingApplicantsResult.data ?? []).some(
    (applicant) =>
      applicant.requested_role !== null &&
      applicant.requested_role !== 'student' &&
      applicant.requested_role !== 'resource_owner',
  )
  if (pendingApplicantsResult.error) {
    logSupabaseError('Loading pending institution applicants failed', pendingApplicantsResult.error)
  } else if (unexpectedApplicantRole) {
    logSupabaseError('Validating pending institution applicants failed', {
      code: 'invalid_data',
      message: 'A pending applicant has an unsupported requested role.',
    })
  }

  const resources = (resourcesResult.data ?? []) as InstitutionResourceEntry[]
  const bookings = (bookingsResult.data ?? []).map((booking) => {
    const resource = booking.resources as { name?: string; owner_name?: string } | null
    return {
      id: booking.id,
      resource_id: booking.resource_id,
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      purpose: booking.purpose,
      status: booking.status,
      decision_note: booking.decision_note,
      created_at: booking.created_at,
      resource_name: resource?.name ?? null,
      owner_name: resource?.owner_name ?? null,
    } satisfies InstitutionBookingEntry
  })

  return {
    institution,
    email: user.email ?? '',
    membershipCounts:
      activeMemberships.error || pendingMemberships.error
        ? null
        : {
            active: activeMemberships.count ?? 0,
            pending: pendingMemberships.count ?? 0,
          },
    resources,
    resourceCount: resourcesResult.error ? null : resourcesResult.count ?? 0,
    resourcesLoadError: Boolean(resourcesResult.error),
    bookings,
    bookingCount: bookingsResult.error ? null : bookingsResult.count ?? 0,
    bookingsLoadError: Boolean(bookingsResult.error),
    openIncidentCount: incidentCountResult.error ? null : incidentCountResult.count ?? 0,
    pendingApplicants: pendingApplicantsResult.error || unexpectedApplicantRole
      ? null
      : ((pendingApplicantsResult.data ?? []) as PendingApplicant[]),
    applicantLoadError: Boolean(pendingApplicantsResult.error) || unexpectedApplicantRole,
  }
}
