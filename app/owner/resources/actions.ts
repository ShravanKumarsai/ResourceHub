'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspaceRole } from '@/lib/auth/workspace'
import type { ResourceSaveInput } from '@/lib/types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
      .select('id, owner_membership_id, institution_id, image_path, archived_at')
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
      .update({
        ...editableFields,
        listed: existingResult.data.archived_at ? false : editableFields.listed,
      })
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
  if (
    typeof resourceId !== 'string' ||
    !UUID_PATTERN.test(resourceId) ||
    (imagePath !== null && typeof imagePath !== 'string') ||
    typeof listed !== 'boolean'
  ) {
    throw new Error('Resource image details are invalid.')
  }
  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('owner_membership_id, institution_id, archived_at')
    .eq('id', resourceId)
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (resourceError) throw resourceError
  if (!resource) throw new Error('Resource not found or you do not own it.')
  await requireOwnerMembership(supabase, user.id, resource.owner_membership_id)

  if (imagePath !== null && !imagePath.startsWith(`${resourceId}/`)) {
    throw new Error('Image path does not match this resource.')
  }

  const { error } = await supabase
    .from('resources')
    .update({ image_path: imagePath, listed: resource.archived_at ? false : listed })
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
  if (typeof resourceId !== 'string' || !UUID_PATTERN.test(resourceId)) {
    throw new Error('Resource image details are invalid.')
  }
  const { data, error } = await supabase
    .from('resources')
    .select('image_path, owner_membership_id')
    .eq('id', resourceId)
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Resource not found or you do not own it.')
  await requireOwnerMembership(supabase, user.id, data.owner_membership_id)

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
    typeof resourceId !== 'string' ||
    !UUID_PATTERN.test(resourceId) ||
    !values ||
    typeof values !== 'object' ||
    Array.isArray(values) ||
    Object.keys(values).length === 0 ||
    Object.keys(values).some((key) => key !== 'listed' && key !== 'availability') ||
    (values.listed !== undefined && typeof values.listed !== 'boolean') ||
    (values.availability !== undefined &&
      !['available', 'limited', 'unavailable'].includes(values.availability))
  ) {
    throw new Error('Resource update is invalid.')
  }

  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('owner_membership_id, archived_at')
    .eq('id', resourceId)
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (resourceError) throw resourceError
  if (!resource) throw new Error('Resource not found or you do not own it.')
  await requireOwnerMembership(supabase, user.id, resource.owner_membership_id)
  if (resource.archived_at) throw new Error('Restore this resource before changing its listing.')

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

export async function archiveResource(resourceId: string) {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  if (typeof resourceId !== 'string' || !UUID_PATTERN.test(resourceId)) {
    throw new Error('The selected resource is invalid.')
  }

  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('owner_membership_id, archived_at')
    .eq('id', resourceId)
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (resourceError) throw resourceError
  if (!resource) throw new Error('Resource not found or you do not own it.')
  await requireOwnerMembership(supabase, user.id, resource.owner_membership_id)
  if (resource.archived_at) throw new Error('This resource is already archived.')

  const { data: activeBookings, error: bookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('resource_id', resourceId)
    .in('status', ['pending', 'approved', 'in_use'])
    .limit(1)
  if (bookingError) throw bookingError
  if (activeBookings?.length) {
    throw new Error('Resolve all pending, approved, or in-use bookings before archiving this resource.')
  }

  const { error } = await supabase.rpc('archive_resource', { p_resource_id: resourceId })
  if (error) {
    if (error.message.toLowerCase().includes('active bookings')) {
      throw new Error('Resolve all pending, approved, or in-use bookings before archiving this resource.')
    }
    throw new Error(error.message || 'This resource could not be archived.')
  }

  revalidateResourcePaths(resourceId)
  return { resourceId }
}

export async function restoreResource(resourceId: string) {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  if (typeof resourceId !== 'string' || !UUID_PATTERN.test(resourceId)) {
    throw new Error('The selected resource is invalid.')
  }

  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('owner_membership_id, archived_at')
    .eq('id', resourceId)
    .eq('owner_user_id', user.id)
    .maybeSingle()
  if (resourceError) throw resourceError
  if (!resource) throw new Error('Resource not found or you do not own it.')
  await requireOwnerMembership(supabase, user.id, resource.owner_membership_id)
  if (!resource.archived_at) throw new Error('This resource is not archived.')

  const { error } = await supabase.rpc('restore_resource', { p_resource_id: resourceId })
  if (error) throw new Error(error.message || 'This resource could not be restored.')

  revalidateResourcePaths(resourceId)
  return { resourceId }
}

function revalidateResourcePaths(resourceId: string) {
  revalidatePath('/')
  revalidatePath('/explore')
  revalidatePath('/student/explore')
  revalidatePath('/student/saved')
  revalidatePath('/owner/resources')
  revalidatePath(`/resources/${resourceId}`)
  revalidatePath(`/student/explore/${resourceId}`)
}
