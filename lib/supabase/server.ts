import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseConfig } from './config'
import type { Database } from './database.types'

export async function createClient() {
  const { url, publishableKey } = getSupabaseConfig()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('Cookies can only be modified')
          ) {
            return
          }

          throw error
        }
      },
    },
  })
}
