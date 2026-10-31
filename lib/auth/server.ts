import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function isMissingAuthSession(error: { name?: string; message?: string } | null | undefined) {
  return (
    error?.name === 'AuthSessionMissingError' ||
    /auth session missing/i.test(error?.message ?? '')
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
    if (isMissingAuthSession(error as { name?: string; message?: string })) {
      redirect('/login')
    }

    throw error
  }
}
