import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { requireServiceRoleConfig } from './config'

export function createAdminClient() {
  const { url, serviceRoleKey } = requireServiceRoleConfig()

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
