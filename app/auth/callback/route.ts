import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logSupabaseError } from '@/lib/supabase/dev-error'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return redirectTo(request, '/login?auth_error=1')

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) return redirectTo(request, '/login?auth_error=1')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) return redirectTo(request, '/login?auth_error=1')

  const user = userData.user
  const institutionId = request.nextUrl.searchParams.get('institution_id')
  const requestedRole = request.nextUrl.searchParams.get('requested_role')
  if (!institutionId || !UUID_PATTERN.test(institutionId)) {
    return redirectTo(request, '/auth/status?setup_error=institution')
  }
  if (requestedRole !== 'student' && requestedRole !== 'resource_owner') {
    return redirectTo(request, '/auth/status?setup_error=request_role')
  }

  const displayName =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === 'string'
          ? user.user_metadata.name
          : null

  if (typeof displayName === 'string' && displayName.trim()) {
    const cleanedDisplayName = displayName.trim().slice(0, 120)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: cleanedDisplayName }, { onConflict: 'id' })
      .select('id')
      .maybeSingle()

    const { error: authMetadataError } = await supabase.auth.updateUser({
      data: {
        display_name: cleanedDisplayName,
        full_name: cleanedDisplayName,
        name: cleanedDisplayName,
      },
    })

    if (authMetadataError) {
      logSupabaseError('Refreshing user display metadata failed', authMetadataError)
    }

    if (profileError) throw profileError
    if (!profile) return redirectTo(request, '/auth/status?setup_error=profile')
  }

  const { data: institution, error: institutionError } = await supabase
    .from('institutions')
    .select('id')
    .eq('id', institutionId)
    .eq('is_active', true)
    .maybeSingle()

  if (institutionError) throw institutionError
  if (!institution) return redirectTo(request, '/auth/status?setup_error=institution')

  const { data: existingMembership, error: membershipLookupError } = await supabase
    .from('institution_memberships')
    .select('id')
    .eq('institution_id', institutionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipLookupError) throw membershipLookupError

  if (!existingMembership) {
    const { error: membershipInsertError } = await supabase
      .from('institution_memberships')
      .insert({
        institution_id: institutionId,
        user_id: user.id,
        requested_role: requestedRole,
      })

    if (membershipInsertError && membershipInsertError.code !== '23505') {
      logSupabaseError('Confirmation callback membership insert failed', membershipInsertError)
      return redirectTo(request, '/auth/status?setup_error=membership')
    }
  }

  return redirectTo(request, '/auth/status?setup=requested')
}
