import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { requireAuthenticatedUser } from '@/lib/auth/server'
import { getInitials, resolveDisplayName, type AccountIdentity } from '@/lib/identity'
import { logSupabaseError } from '@/lib/supabase/dev-error'

type ServerSupabase = Awaited<ReturnType<typeof requireAuthenticatedUser>>['supabase']

export async function getAccountIdentity(
  supabase: ServerSupabase,
  user: User,
  knownInstitutionName?: string,
): Promise<AccountIdentity> {
  const [profileResult, membershipResult] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    knownInstitutionName
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from('institution_memberships')
          .select('institutions(name)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle(),
  ])

  if (profileResult.error) logSupabaseError('Loading account identity failed', profileResult.error)
  if (membershipResult.error) logSupabaseError('Loading account institution failed', membershipResult.error)

  const name = resolveDisplayName({
    profileName: profileResult.data?.display_name,
    metadata: user.user_metadata,
    email: user.email,
  })

  const embedded = (membershipResult.data as { institutions: { name: string } | { name: string }[] | null } | null)
    ?.institutions
  const embeddedName = Array.isArray(embedded) ? embedded[0]?.name : embedded?.name

  return {
    name,
    initials: getInitials(name),
    email: user.email ?? '',
    institutionName: knownInstitutionName ?? embeddedName ?? null,
  }
}
