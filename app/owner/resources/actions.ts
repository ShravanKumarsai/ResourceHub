'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspaceRole } from '@/lib/auth/workspace'
import type { ResourceSaveInput } from '@/lib/types'

function normalizeCategoryValue(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function validateInput(input: ResourceSaveInput) {
  const normalizedCategory = normalizeCategoryValue(input.category)
  if (
    !input.ownerMembershipId ||
    input.name.trim().length < 1 ||
    input.name.trim().length > 200 ||
    !normalizedCategory ||
    normalizedCategory.length > 120 ||
    input.location.trim().length < 1 ||
    input.location.trim().length > 240 ||
    input.description.trim().length < 20 ||
    input.description.trim().length > 10000 ||
    !Number.isFinite(input.hourlyRate) ||
    input.hourlyRate < 0 ||
    !Number.isSafeInteger(input.maxDurationHours) ||
    input.maxDurationHours < 1 ||
    input.maxDurationHours > 168 ||
    !['available', 'limited', 'unavailable'].includes(input.availability) ||
    !['Owner approval', 'Automatic confirmation'].includes(input.approval)
  ) {
    throw new Error('Resource details are invalid.')
  }

  const arrays = [
    input.highlights,
    input.eligibility,
    input.training,
    input.safety,
    input.useCases,
    input.instructions,
  ]
  if (
    arrays.some(
      (items) =>
        !Array.isArray(items) ||
        items.length > 100 ||
        items.some((item) => typeof item !== 'string' || item.length > 1000),
    ) ||
    !Array.isArray(input.specs) ||
    input.specs.length > 100 ||
    input.specs.some(
      (spec) =>
        typeof spec.label !== 'string' ||
        typeof spec.value !== 'string' ||
        spec.label.length > 120 ||
        spec.value.length > 1000,
    )
  ) {
    throw new Error('Resource details exceed the allowed limits.')
  }
}

async function requireOwnerMembership(supabase: Awaited<ReturnType<typeof requireWorkspaceRole>>['supabase'], userId: string, membershipId: string) {
  const membershipResult = await supabase
    .from('institution_memberships')
    .select('id, institution_id')
    .eq('id', membershipId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (membershipResult.error) throw membershipResult.error
  if (!membershipResult.data) throw new Error('An active resource-owner membership is required.')

  const roleResult = await supabase
    .from('institution_membership_roles')
    .select('membership_id')
    .eq('membership_id', membershipId)
    .eq('role', 'resource_owner')
    .maybeSingle()

  if (roleResult.error) throw roleResult.error
  if (!roleResult.data) throw new Error('An active resource-owner membership is required.')
  return membershipResult.data
}

export async function saveResource(input: ResourceSaveInput) {
  validateInput(input)
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  const membership = await requireOwnerMembership(supabase, user.id, input.ownerMembershipId)
  const editableFields = {
    name: input.name.trim(),
    category: normalizeCategoryValue(input.category),
    location: input.location.trim(),
    description: input.description.trim(),
    specifications: input.specs.map((spec) => ({ label: spec.label, value: spec.value })),
    highlights: input.highlights,
    availability: input.availability,
    hourly_rate: input.hourlyRate,
    max_duration_hours: input.maxDurationHours,
    approval_mode: input.approval === 'Automatic confirmation' ? 'automatic' : 'owner',
    eligibility: input.eligibility,
    training: input.training,
    safety: input.safety,
    use_cases: input.useCases,
    instructions: input.instructions,
    listed: input.hasNewImage && !input.id ? false : input.listed,
  }
  const nextRow = {
    ...editableFields,
    image_path: null,
    owner_membership_id: membership.id,
    institution_id: membership.institution_id,
    owner_user_id: user.id,
  }

  let resourceId = input.id
  let previousImagePath: string | null = null

  if (resourceId) {
    const existingResult = await supabase
      .from('resources')
      .select('id, owner_membership_id, institution_id, image_path')
      .eq('id', resourceId)
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (existingResult.error) throw existingResult.error
    if (!existingResult.data) throw new Error('Resource not found or you do not own it.')
    if (existingResult.data.owner_membership_id !== membership.id || existingResult.data.institution_id !== membership.institution_id) {
      throw new Error('The selected institution membership does not own this resource.')
    }
    previousImagePath = existingResult.data.image_path

    const { error } = await supabase
      .from('resources')
      .update(editableFields)
      .eq('id', resourceId)
      .eq('owner_user_id', user.id)
    if (error) throw error
  } else {
    const { data, error } = await supabase
      .from('resources')
      .insert(nextRow)
      .select('id')
      .single()
    if (error) throw error
    resourceId = data.id
  }

  revalidatePath('/')
  revalidatePath('/explore')
  revalidatePath('/student/explore')
  revalidatePath('/owner/resources')
  return { id: resourceId, previousImagePath }
}

export async function setResourceImagePath(
  resourceId: string,
  imagePath: string | null,
  listed: boolean,
) {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  if (imagePath !== null && !imagePath.startsWith(`${resourceId}/`)) {
    throw new Error('Image path does not match this resource.')
  }

  const { error } = await supabase
    .from('resources')
    .update({ image_path: imagePath, listed })
    .eq('id', resourceId)
    .eq('owner_user_id', user.id)

  if (error) throw error
  revalidatePath('/')
  revalidatePath('/explore')
  revalidatePath('/student/explore')
  revalidatePath('/owner/resources')
  revalidatePath(`/resources/${resourceId}`)
  revalidatePath(`/student/explore/${resourceId}`)
}

export async function removeResourceImage(resourceId: string) {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  const { data, error } = await supabase
    .from('resources')
    .select('image_path')
    .eq('id', resourceId)
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Resource not found or you do not own it.')

  const imagePath = data.image_path
  const { error: updateError } = await supabase
    .from('resources')
    .update({ image_path: null })
    .eq('id', resourceId)
    .eq('owner_user_id', user.id)

  if (updateError) throw updateError

  if (imagePath) {
    const { error: deleteError } = await supabase.storage.from('resource-images').remove([imagePath])
    if (deleteError) {
      throw new Error('The image reference was cleared, but the storage object could not be removed automatically.')
    }
  }

  revalidatePath('/')
  revalidatePath('/explore')
  revalidatePath('/student/explore')
  revalidatePath('/owner/resources')
  revalidatePath(`/resources/${resourceId}`)
  revalidatePath(`/student/explore/${resourceId}`)

  return { resourceId }
}

export async function updateResourceListing(
  resourceId: string,
  values: { listed?: boolean; availability?: ResourceSaveInput['availability'] },
) {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  if (
    Object.keys(values).length === 0 ||
    (values.availability !== undefined &&
      !['available', 'limited', 'unavailable'].includes(values.availability))
  ) {
    throw new Error('Resource update is invalid.')
  }

  const { error } = await supabase
    .from('resources')
    .update(values)
    .eq('id', resourceId)
    .eq('owner_user_id', user.id)
  if (error) throw error

  revalidatePath('/')
  revalidatePath('/explore')
  revalidatePath('/student/explore')
  revalidatePath('/owner/resources')
}
