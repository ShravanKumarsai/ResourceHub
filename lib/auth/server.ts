import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export function isMissingAuthSession(error: unknown) {
  if (typeof error !== 'object' || error === null) return false

  const authError = error as { name?: unknown; message?: unknown }
  return (
    authError.name === 'AuthSessionMissingError' ||
    (typeof authError.message === 'string' &&
      /auth session missing/i.test(authError.message))
  )
}

export async function requireAuthenticatedUser() {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      if (isMissingAuthSession(error)) {
        redirect('/login')
      }
      throw error
    }

    if (!data.user) {
      redirect('/login')
    }

    return { supabase, user: data.user }
  } catch (error) {
    if (isMissingAuthSession(error)) {
      redirect('/login')
    }

    throw error
  }
}
