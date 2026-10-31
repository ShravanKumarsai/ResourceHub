import 'server-only'

import { createClient } from '@/lib/supabase/server'

export async function enforceRateLimit(scope: string, limit: number, windowSeconds: number) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_scope: scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })

  if (error) throw error
  if (!data) {
    throw new Error('Too many requests. Please try again later.')
  }
}
