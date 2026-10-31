'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthenticatedUser } from '@/lib/auth/server'
import { logSupabaseError } from '@/lib/supabase/dev-error'
import { enforceRateLimit } from '@/lib/security/rate-limit'

export type MembershipRequestState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const INITIAL_STATE: MembershipRequestState = { status: 'idle', message: '' }
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function submitMembershipRequestAction(
  _previousState: MembershipRequestState = INITIAL_STATE,
  formData: FormData,
): Promise<MembershipRequestState> {
  const { supabase, user } = await requireAuthenticatedUser()
  await enforceRateLimit('membership:request', 5, 300)
  const institutionId = formData.get('institution_id')
  const requestedRole = formData.get('requested_role')

  if (typeof institutionId !== 'string' || !UUID_PATTERN.test(institutionId)) {
    return { status: 'error', message: 'Choose a valid institution.' }
  }

  if (requestedRole !== 'student' && requestedRole !== 'resource_owner') {
    return { status: 'error', message: 'Choose Student or Resource Manager.' }
  }

  const { data: institution, error: institutionError } = await supabase
    .from('institutions')
    .select('id')
    .eq('id', institutionId)
    .eq('is_active', true)
    .maybeSingle()

  if (institutionError) {
    logSupabaseError('Validating requested institution failed', institutionError)
    return { status: 'error', message: 'The institution could not be verified. Please try again.' }
  }

  if (!institution) {
    return { status: 'error', message: 'That institution is not currently accepting requests.' }
  }

  const { data: existingMembership, error: lookupError } = await supabase
    .from('institution_memberships')
    .select('id')
    .eq('institution_id', institutionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (lookupError) {
    logSupabaseError('Checking for an existing membership request failed', lookupError)
    return { status: 'error', message: 'Your existing membership could not be checked. Please try again.' }
  }

  if (existingMembership) {
    return {
      status: 'error',
      message: 'A membership record already exists for this institution. Check its status below.',
    }
  }

  const { error: insertError } = await supabase.from('institution_memberships').insert({
    institution_id: institutionId,
    user_id: user.id,
    requested_role: requestedRole,
  })

  if (insertError) {
    logSupabaseError('Membership request insert failed', insertError)
    return {
      status: 'error',
      message:
        insertError.code === '23505'
          ? 'A membership record already exists for this institution. Check its status below.'
          : 'Your request could not be submitted. Please try again later.',
    }
  }

  revalidatePath('/auth/status')
  return {
    status: 'success',
    message: 'Membership request submitted. Access is available only after institution approval.',
  }
}
