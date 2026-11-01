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
    .order('institution_id', { ascending: true })

  if (membershipError) throw membershipError

  const institutionIds = [...new Set((memberships ?? []).map((membership) => membership.institution_id))]
  if (!institutionIds.length) {
    redirect('/auth/status?institution_access=denied')
  }

  const { data: institution, error: institutionError } = await supabase
    .from('institutions')
    .select('id, name, slug, is_active')
    .in('id', institutionIds)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (institutionError) throw institutionError
  if (!institution) {
    redirect('/auth/status?institution_access=denied')
  }

  return { supabase, user, institution }
}
