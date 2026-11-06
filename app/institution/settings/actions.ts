'use server'

import { revalidatePath } from 'next/cache'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'

export async function loadAccountabilitySettings() {
  const { supabase, institution } = await requireInstitutionAdmin()
  const { data, error } = await supabase.rpc('get_institution_accountability_settings', {
    p_institution_id: institution.id,
  })
  if (error) throw error
  const settings = data?.[0]
  if (!settings) throw new Error('Institution accountability settings were not returned.')
  return { institutionName: institution.name, ...settings }
}

export async function updateAccountabilitySettings(input: {
  lateFlagThreshold: number
  maxUsageDurationMinutes: number | null
  timezone: string
}) {
  if (
    !input ||
    !Number.isInteger(input.lateFlagThreshold) ||
    input.lateFlagThreshold < 1 ||
    input.lateFlagThreshold > 100 ||
    (input.maxUsageDurationMinutes !== null &&
      (!Number.isInteger(input.maxUsageDurationMinutes) ||
        input.maxUsageDurationMinutes < 1 ||
        input.maxUsageDurationMinutes > 10080)) ||
    typeof input.timezone !== 'string' ||
    input.timezone.trim().length > 100
  ) {
    throw new Error('Accountability settings are invalid.')
  }

  const { supabase, institution } = await requireInstitutionAdmin()
  const { error } = await supabase.rpc('set_institution_accountability_settings', {
    p_institution_id: institution.id,
    p_late_flag_threshold: input.lateFlagThreshold,
    p_max_usage_duration_minutes: input.maxUsageDurationMinutes,
    p_timezone: input.timezone.trim(),
  })
  if (error) throw error

  revalidatePath('/institution/settings')
  revalidatePath('/owner/handover')
  revalidatePath('/owner/incidents')
  return { ok: true }
}
