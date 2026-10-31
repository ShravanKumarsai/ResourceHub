import type { Metadata } from 'next'
import { MembershipDirectory } from '@/components/institution/membership-directory'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import { logSupabaseError } from '@/lib/supabase/dev-error'

export const metadata: Metadata = { title: 'Membership directory' }

export default async function InstitutionPage() {
  const { supabase, institution } = await requireInstitutionAdmin()
  const { data, error } = await supabase.rpc('list_institution_membership_directory', {
    p_institution_id: institution.id,
  })

  if (error) {
    logSupabaseError('Loading institution membership directory failed', error)
  }

  const entries = error ? null : ((data as Array<Record<string, unknown>> | null) ?? null)

  return (
    <MembershipDirectory
      institutionName={institution.name}
      entries={entries as any}
      loadError={Boolean(error)}
    />
  )
}
