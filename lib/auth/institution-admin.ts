import 'server-only'
import { redirect } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth/server'

export async function requireInstitutionAdmin() {
  const { supabase, user } = await requireAuthenticatedUser()
  const { data: memberships, error: membershipError } = await supabase
    .from('institution_memberships')
    .select('institution_id, institution_membership_roles!inner(role)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('institution_membership_roles.role', 'institution_admin')
    .limit(1)

  if (membershipError) throw membershipError

  const institutionId = memberships?.[0]?.institution_id
  if (!institutionId) {
    redirect('/auth/status?institution_access=denied')
  }

  const { data: institution, error: institutionError } = await supabase
    .from('institutions')
    .select('id, name, slug, is_active, max_active_reservations_per_user')
    .eq('id', institutionId)
    .eq('is_active', true)
    .maybeSingle()

  if (institutionError) throw institutionError
  if (!institution) {
    redirect('/auth/status?institution_access=denied')
  }

  return { supabase, user, institution }
}
