'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthenticatedUser } from '@/lib/auth/server'
import { logSupabaseError } from '@/lib/supabase/dev-error'

export type ProfileActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
  fieldErrors?: { display_name?: string; title?: string; department?: string }
  profile?: { display_name: string; title: string | null; department: string | null }
}

function readText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const { supabase, user } = await requireAuthenticatedUser()

  const displayName = readText(formData, 'display_name')
  const title = readText(formData, 'title')
  const department = readText(formData, 'department')

  const fieldErrors: NonNullable<ProfileActionState['fieldErrors']> = {}
  if (!displayName) fieldErrors.display_name = 'Enter your full name.'
  else if (displayName.length > 120) fieldErrors.display_name = 'Use 120 characters or fewer.'
  if (title.length > 160) fieldErrors.title = 'Use 160 characters or fewer.'
  if (department.length > 200) fieldErrors.department = 'Use 200 characters or fewer.'

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'Check the highlighted fields and try again.', fieldErrors }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, title: title || null, department: department || null })
    .eq('id', user.id)
    .select('display_name, title, department')
    .maybeSingle()

  if (error || !data) {
    if (error) logSupabaseError('Updating profile failed', error)
    return { status: 'error', message: 'Your profile could not be saved. Please try again.' }
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: { display_name: displayName, full_name: displayName, name: displayName },
  })
  if (metadataError) logSupabaseError('Syncing profile metadata failed', metadataError)

  revalidatePath('/', 'layout')

  return {
    status: 'success',
    message: 'Profile updated.',
    profile: {
      display_name: data.display_name ?? displayName,
      title: data.title,
      department: data.department,
    },
  }
}
