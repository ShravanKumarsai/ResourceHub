import type { Metadata } from 'next'
import {
  MembershipDirectory,
  type InstitutionMembershipDirectoryEntry,
} from '@/components/institution/membership-directory'
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

  const rawEntries = error ? null : data ?? null
  const lateFlagCounts = new Map<string, { count: number; threshold: number }>()
  let lateFlagLoadError = false

  if (rawEntries) {
    const membershipIds = rawEntries
      .filter((entry) => entry.status === 'active' && entry.approved_roles.includes('student'))
      .map((entry) => entry.membership_id)

    for (let offset = 0; offset < membershipIds.length; offset += 100) {
      const { data: countRows, error: countError } = await supabase.rpc(
        'get_institution_member_late_flag_counts',
        {
          p_institution_id: institution.id,
          p_membership_ids: membershipIds.slice(offset, offset + 100),
        },
      )
      if (countError) {
        logSupabaseError('Loading institution late-return counts failed', countError)
        lateFlagLoadError = true
        break
      }
      for (const row of countRows ?? []) {
        lateFlagCounts.set(row.membership_id, {
          count: Number(row.late_flag_count),
          threshold: row.late_flag_threshold,
        })
      }
    }
  }

  const entries: InstitutionMembershipDirectoryEntry[] | null = rawEntries
    ? rawEntries.map((entry) => {
        const lateFlag = lateFlagCounts.get(entry.membership_id)
        return {
          ...entry,
          late_flag_count: lateFlag?.count ?? null,
          late_flag_threshold: lateFlag?.threshold ?? null,
        }
      })
    : null

  return (
    <MembershipDirectory
      institutionName={institution.name}
      entries={entries}
      loadError={Boolean(error)}
      lateFlagLoadError={lateFlagLoadError}
    />
  )
}
