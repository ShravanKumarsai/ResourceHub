'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function getFavoriteStatus(resourceId: string) {
  if (typeof resourceId !== 'string' || !UUID_PATTERN.test(resourceId)) {
    throw new Error('The selected resource is invalid.')
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) return { authenticated: false, saved: false }

  const { data, error } = await supabase
    .from('resource_favorites')
    .select('resource_id')
    .eq('resource_id', resourceId)
    .maybeSingle()
  if (error) throw error

  return { authenticated: true, saved: Boolean(data) }
}

export async function setResourceFavorite(resourceId: string, saved: boolean) {
  if (
    typeof resourceId !== 'string' ||
    !UUID_PATTERN.test(resourceId) ||
    typeof saved !== 'boolean'
  ) {
    throw new Error('Favorite details are invalid.')
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) {
    return { authenticated: false, saved: false }
  }

  if (saved) {
    const { error } = await supabase.from('resource_favorites').insert({
      user_id: authData.user.id,
      resource_id: resourceId,
    })
    if (error && error.code !== '23505') {
      if (error.code === '42501') {
        throw new Error('This resource is no longer available to save.')
      }
      throw error
    }
  } else {
    const { error } = await supabase
      .from('resource_favorites')
      .delete()
      .eq('user_id', authData.user.id)
      .eq('resource_id', resourceId)
    if (error) throw error
  }

  revalidatePath('/explore')
  revalidatePath('/student/explore')
  revalidatePath('/student/saved')
  return { authenticated: true, saved }
}
