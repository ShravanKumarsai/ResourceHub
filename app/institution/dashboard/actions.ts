'use server'

import { revalidatePath } from 'next/cache'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import { logSupabaseError } from '@/lib/supabase/dev-error'

export type MembershipReviewActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const INITIAL_STATE: MembershipReviewActionState = {
  status: 'idle',
  message: '',
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function reviewMembershipAction(
  _previousState: MembershipReviewActionState = INITIAL_STATE,
  formData: FormData,
): Promise<MembershipReviewActionState> {
  const { supabase, institution } = await requireInstitutionAdmin()
  const membershipId = formData.get('membership_id')
  const decision = formData.get('decision')
  const assignedRole = formData.get('assigned_role')

  if (typeof membershipId !== 'string' || !UUID_PATTERN.test(membershipId)) {
    return { status: 'error', message: 'This request is invalid. Refresh and try again.' }
  }

  if (decision !== 'approve' && decision !== 'reject') {
    return { status: 'error', message: 'Choose approve or reject for this request.' }
  }

  const { data: targetMembership, error: membershipError } = await supabase
    .from('institution_memberships')
    .select('id, requested_role')
    .eq('id', membershipId)
    .eq('institution_id', institution.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (membershipError) {
    logSupabaseError('Loading membership before review failed', membershipError)
    return {
      status: 'error',
      message: 'This request is not available in the current institution workspace.',
    }
  }

  if (!targetMembership) {
    return {
      status: 'error',
      message: 'This request is no longer pending in the current institution workspace.',
    }
  }

  let roles: string[] = []
  if (decision === 'approve') {
    if (
      targetMembership.requested_role === 'student' ||
      targetMembership.requested_role === 'resource_owner'
    ) {
      roles = [targetMembership.requested_role]
    } else if (
      targetMembership.requested_role === null &&
      (assignedRole === 'student' || assignedRole === 'resource_owner')
    ) {
      roles = [assignedRole]
    } else {
      return {
        status: 'error',
        message: 'This request has no valid requested role. Contact an administrator.',
      }
    }
  }

  const { error } = await supabase.rpc('review_institution_membership', {
    p_membership_id: membershipId,
    p_status: decision === 'approve' ? 'active' : 'rejected',
    p_roles: roles,
  })

  if (error) {
    logSupabaseError('Institution membership review failed', error)

    if (error.code === '55000') {
      return {
        status: 'error',
        message: 'This request has already been reviewed. Refresh the dashboard.',
      }
    }

    if (error.code === '42501') {
      return {
        status: 'error',
        message: 'You are not authorized to review this institution request.',
      }
    }

    return {
      status: 'error',
      message: 'The review could not be saved. Please try again.',
    }
  }

  revalidatePath('/institution/dashboard')
  return {
    status: 'success',
    message: decision === 'approve' ? 'Membership approved.' : 'Membership request rejected.',
  }
}

export async function updateInstitutionReservationLimitAction(
  _previousState: MembershipReviewActionState = INITIAL_STATE,
  formData: FormData,
): Promise<MembershipReviewActionState> {
  const { supabase, institution } = await requireInstitutionAdmin()
  const rawLimit = formData.get('max_active_reservations_per_user')
  const limit = typeof rawLimit === 'string' ? Number(rawLimit) : Number.NaN

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return { status: 'error', message: 'Choose a whole-number limit between 1 and 50.' }
  }

  const { error } = await supabase.rpc('update_institution_reservation_limit', {
    p_institution_id: institution.id,
    p_limit: limit,
  })

  if (error) {
    logSupabaseError('Updating institution reservation limit failed', error)
    if (error.code === '42501') {
      return { status: 'error', message: 'Only active institution administrators can change this limit.' }
    }
    if (error.code === 'PGRST202' || error.code === '42883') {
      return { status: 'error', message: 'Reservation limits are not available until the database migration is applied.' }
    }
    return { status: 'error', message: 'The reservation limit could not be saved. Please try again.' }
  }

  revalidatePath('/institution', 'layout')
  return { status: 'success', message: 'Reservation limit updated.' }
}

export async function updateInstitutionNameAction(
  _previousState: MembershipReviewActionState = INITIAL_STATE,
  formData: FormData,
): Promise<MembershipReviewActionState> {
  const { supabase, institution } = await requireInstitutionAdmin()
  const rawName = formData.get('name')

  if (typeof rawName !== 'string') {
    return { status: 'error', message: 'Enter an institution name.' }
  }

  const name = rawName.trim()
  if (!name) {
    return { status: 'error', message: 'Enter an institution name.' }
  }
  if (name.length > 200) {
    return { status: 'error', message: 'Use 200 characters or fewer.' }
  }

  const { error } = await supabase.rpc('update_institution_name', {
    p_institution_id: institution.id,
    p_name: name,
  })

  if (error) {
    logSupabaseError('Updating institution name failed', error)

    if (error.code === '42501') {
      return { status: 'error', message: 'Only active institution administrators can rename this institution.' }
    }
    if (error.code === 'PGRST202' || error.code === '42883') {
      return {
        status: 'error',
        message: 'Renaming is not available yet because the database update has not been applied.',
      }
    }
    return { status: 'error', message: 'The institution name could not be saved. Please try again.' }
  }

  revalidatePath('/institution', 'layout')
  return { status: 'success', message: 'Institution name updated.' }
}
