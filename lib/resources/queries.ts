import 'server-only'
import { requireWorkspaceRole } from '@/lib/auth/workspace'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import type { Resource, ResourceOwnerMembership, Spec } from '@/lib/types'

type ResourceRow = Database['public']['Tables']['resources']['Row']

function normalizeCategoryValue(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function toSpecs(value: ResourceRow['specifications']): Spec[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (
      typeof item === 'object' &&
      item !== null &&
      !Array.isArray(item) &&
      typeof item.label === 'string' &&
      typeof item.value === 'string'
    ) {
      return [{ label: item.label, value: item.value }]
    }
    return []
  })
}

async function mapResources(rows: ResourceRow[], supabase: Awaited<ReturnType<typeof createClient>>) {
  const institutionIds = [...new Set(rows.map((row) => row.institution_id))]
  const institutionsResult = institutionIds.length
    ? await supabase.from('institutions').select('id, name').in('id', institutionIds)
    : { data: [], error: null }

  if (institutionsResult.error) throw institutionsResult.error
  const institutionNames = new Map(
    (institutionsResult.data ?? []).map((institution) => [institution.id, institution.name]),
  )

  return rows.map<Resource>((row) => ({
    id: row.id,
    institutionId: row.institution_id,
    ownerMembershipId: row.owner_membership_id,
    ownerId: row.owner_user_id,
    ownerName: row.owner_name,
    name: row.name,
    category: row.category as Resource['category'],
    institution: institutionNames.get(row.institution_id) ?? 'Institution',
    location: row.location,
    description: row.description,
    imagePath: row.image_path,
    image: row.image_path
      ? supabase.storage.from('resource-images').getPublicUrl(row.image_path).data.publicUrl
      : '',
    specs: toSpecs(row.specifications),
    highlights: row.highlights,
    availability: row.availability as Resource['availability'],
    hourlyRate: Number(row.hourly_rate),
    maxDurationHours: row.max_duration_hours,
    approval: row.approval_mode === 'automatic' ? 'Automatic confirmation' : 'Owner approval',
    eligibility: row.eligibility,
    training: row.training,
    safety: row.safety,
    useCases: row.use_cases,
    instructions: row.instructions,
    listed: row.listed,
  }))
}

export async function listListedResources() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('listed', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return mapResources(data ?? [], supabase)
}

export async function getListedResource(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', id)
    .eq('listed', true)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return (await mapResources([data], supabase))[0]
}

export async function listOwnedResources() {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return mapResources(data ?? [], supabase)
}

export async function getOwnedResource(id: string) {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', id)
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return (await mapResources([data], supabase))[0]
}

export async function listResourceOwnerMemberships(): Promise<ResourceOwnerMembership[]> {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  const membershipsResult = await supabase
    .from('institution_memberships')
    .select('id, institution_id')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (membershipsResult.error) throw membershipsResult.error
  const memberships = membershipsResult.data ?? []
  if (!memberships.length) return []

  const rolesResult = await supabase
    .from('institution_membership_roles')
    .select('membership_id')
    .in('membership_id', memberships.map((membership) => membership.id))
    .eq('role', 'resource_owner')

  if (rolesResult.error) throw rolesResult.error
  const ownerMembershipIds = new Set((rolesResult.data ?? []).map((role) => role.membership_id))
  const ownerMemberships = memberships.filter((membership) => ownerMembershipIds.has(membership.id))
  const institutionIds = [...new Set(ownerMemberships.map((membership) => membership.institution_id))]
  if (!institutionIds.length) return []

  const institutionsResult = await supabase
    .from('institutions')
    .select('id, name')
    .in('id', institutionIds)
    .eq('is_active', true)

  if (institutionsResult.error) throw institutionsResult.error
  const institutionNames = new Map(
    (institutionsResult.data ?? []).map((institution) => [institution.id, institution.name]),
  )

  return ownerMemberships.flatMap((membership) => {
    const institutionName = institutionNames.get(membership.institution_id)
    return institutionName
      ? [{ id: membership.id, institutionId: membership.institution_id, institutionName }]
      : []
  })
}

export async function listResourceCategories(): Promise<string[]> {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  const membershipsResult = await supabase
    .from('institution_memberships')
    .select('institution_id')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (membershipsResult.error) throw membershipsResult.error
  const institutionIds = [...new Set((membershipsResult.data ?? []).map((item) => item.institution_id))]
  if (!institutionIds.length) return []

  const { data, error } = await supabase
    .from('resources')
    .select('category')
    .in('institution_id', institutionIds)

  if (error) throw error

  const uniqueCategories = new Map<string, string>()
  for (const row of data ?? []) {
    const value = normalizeCategoryValue(row.category ?? '')
    if (!value) continue
    const key = value.toLowerCase()
    if (!uniqueCategories.has(key)) uniqueCategories.set(key, value)
  }

  return [...uniqueCategories.values()].sort((a, b) => a.localeCompare(b))
}

export async function listActiveInstitutionNames() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('institutions')
    .select('name')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return (data ?? []).map((institution) => institution.name)
}
