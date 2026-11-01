'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthenticatedUser } from '@/lib/auth/server'
import { requireWorkspaceRole } from '@/lib/auth/workspace'

const INVALID_TIME_MESSAGE = 'Choose a valid future time range before submitting.'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/
const reservationControlsEnabled = process.env.RESERVATION_CONTROLS_ENABLED === 'true'

function parseDate(iso: string) {
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) {
    throw new Error(INVALID_TIME_MESSAGE)
  }
  return value
}

function toRpcErrorMessage(error: { message?: string; code?: string }) {
  const message = error?.message ?? ''
  if (error.code === 'PGRST202') return 'Availability and waiting-list support is not enabled in the database yet.'
  if (message.toLowerCase().includes('authentication required')) return 'You need to be signed in to complete this action.'
  if (message.toLowerCase().includes('booking details are invalid')) return 'Booking details are invalid. Check the date, time range and purpose.'
  if (message.toLowerCase().includes('resource is unavailable')) return 'This resource is not accepting bookings right now.'
  if (message.toLowerCase().includes('rate limit')) return 'Too many booking requests. Please wait a minute and try again.'
  if (message.toLowerCase().includes('active reservation limit')) return "You have reached your institution's active reservation limit."
  if (message.toLowerCase().includes('overlapping resource limit')) return 'You have reached the maximum number of resources you can reserve at the same time.'
  if (message.toLowerCase().includes('already have an overlapping booking')) return 'You already have an overlapping booking request for this resource.'
  if (message.toLowerCase().includes('booking start time has passed')) return 'The booking start time has passed, so it can no longer be approved.'
  if (message.toLowerCase().includes('active student membership required')) return 'You need an active student membership in this institution to make bookings.'
  if (message.toLowerCase().includes('pending bookings can be reviewed')) return 'This request can no longer be reviewed.'
  if (message.toLowerCase().includes('active resource owner authorization required')) return 'You are not authorised to manage this resource.'
  if (message.toLowerCase().includes('booking participant authorization required')) return 'You are not a valid participant for this booking.'
  if (message.toLowerCase().includes('this booking cannot be cancelled')) return 'This booking cannot be cancelled from its current state.'
  if (message.toLowerCase().includes('condition report is invalid')) return 'The handover report could not be saved. Review the checklist and notes.'
  if (message.toLowerCase().includes('already joined this waiting list')) return 'You are already on the waiting list for this time slot.'
  if (message.toLowerCase().includes('requested time is not blocked by a confirmed booking')) return 'This time is no longer blocked by a confirmed booking, so a waiting-list entry is not needed.'
  if (message.toLowerCase().includes('waiting-list entry not found')) return 'This waiting-list entry could not be found.'
  if (message.toLowerCase().includes('only active waiting-list entries can be cancelled')) return 'This waiting-list entry is no longer active.'
  if (message.toLowerCase().includes('already')) return 'A matching booking already exists for this request.'
  if (message.toLowerCase().includes('overlap') || message.toLowerCase().includes('conflict')) return 'This time overlaps with an existing approved booking.'
  if (message.toLowerCase().includes('not found')) return 'This booking could not be found.'
  return message || 'The booking action could not be completed. Please try again.'
}

function parseUtcDate(value: unknown) {
  if (typeof value !== 'string' || !UTC_ISO_PATTERN.test(value)) {
    throw new Error(INVALID_TIME_MESSAGE)
  }
  const parsed = new Date(value)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 19) !== value.slice(0, 19)
  ) {
    throw new Error(INVALID_TIME_MESSAGE)
  }
  return parsed
}

async function hasActiveStudentMembership(supabase: Awaited<ReturnType<typeof requireWorkspaceRole>>['supabase'], institutionId: string) {
  const { data, error } = await supabase
    .from('institution_memberships')
    .select('id')
    .eq('institution_id', institutionId)
    .eq('user_id', (await requireWorkspaceRole('student')).user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  return !!data
}

export async function submitBookingRequest(input: {
  resourceId: string
  startsAt: string
  endsAt: string
  purpose: string
  idempotencyKey: string
}) {
  const { supabase, user } = await requireWorkspaceRole('student')

  if (!input.resourceId || !UUID_PATTERN.test(input.resourceId)) {
    throw new Error('The selected resource is invalid.')
  }
  if (!UUID_PATTERN.test(input.idempotencyKey)) {
    throw new Error('This booking request could not be verified. Please try again.')
  }

  const startsAt = parseDate(input.startsAt)
  const endsAt = parseDate(input.endsAt)
  const purpose = input.purpose.trim()

  if (!purpose || purpose.length < 15 || purpose.length > 5000) {
    throw new Error('Describe the purpose of your booking in at least 15 characters.')
  }

  if (
    endsAt <= startsAt ||
    (!reservationControlsEnabled && startsAt <= new Date())
  ) {
    throw new Error(INVALID_TIME_MESSAGE)
  }

  if (!reservationControlsEnabled) {
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('id, institution_id, availability, max_duration_hours, approval_mode, listed')
      .eq('id', input.resourceId)
      .eq('listed', true)
      .maybeSingle()

    if (resourceError) throw resourceError
    if (!resource || resource.availability === 'unavailable') {
      throw new Error('This resource is not currently available for bookings.')
    }

    const durationHours = (endsAt.getTime() - startsAt.getTime()) / 3600000
    if (durationHours > resource.max_duration_hours) {
      throw new Error(`Sessions are limited to ${resource.max_duration_hours} hours for this resource.`)
    }

    const { data: existingBookings, error: lookupError } = await supabase
      .from('bookings')
      .select('id, starts_at, ends_at, status')
      .eq('resource_id', input.resourceId)
      .eq('requester_user_id', user.id)
      .in('status', ['pending', 'approved', 'in_use'])

    if (lookupError) throw lookupError

    const hasOverlap = (existingBookings ?? []).some((booking) => {
      const bookingStart = new Date(booking.starts_at)
      const bookingEnd = new Date(booking.ends_at)
      return bookingStart < endsAt && startsAt < bookingEnd
    })

    if (hasOverlap) {
      throw new Error('You already have an overlapping booking request for this resource.')
    }
  }

  const rpcArgs = {
    p_resource_id: input.resourceId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_purpose: purpose,
  }
  const { data, error } = await supabase.rpc(
    'request_resource_booking',
    reservationControlsEnabled
      ? { ...rpcArgs, p_idempotency_key: input.idempotencyKey }
      : rpcArgs,
  )

  if (error) {
    throw new Error(toRpcErrorMessage(error))
  }

  revalidatePath('/student/bookings')
  revalidatePath('/student/dashboard')
  revalidatePath('/student/explore')
  if (!data) throw new Error('The booking request did not return a booking reference.')
  return { bookingId: data }
}

export async function getBookingAvailability(input: {
  resourceId: string
  startsAt: string
  endsAt: string
}) {
  if (
    !input ||
    typeof input !== 'object' ||
    !UUID_PATTERN.test(input.resourceId) ||
    typeof input.startsAt !== 'string' ||
    typeof input.endsAt !== 'string'
  ) {
    throw new Error('The availability request is invalid.')
  }

  const startsAt = parseUtcDate(input.startsAt)
  const endsAt = parseUtcDate(input.endsAt)
  if (endsAt <= startsAt || startsAt <= new Date()) {
    throw new Error(INVALID_TIME_MESSAGE)
  }

  const { supabase } = await requireWorkspaceRole('student')
  const { data, error } = await supabase.rpc('get_resource_booking_availability', {
    p_resource_id: input.resourceId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
  })

  if (error) {
    throw new Error(toRpcErrorMessage(error))
  }

  const result = data?.[0]
  if (!result) {
    throw new Error('Availability could not be confirmed by the database.')
  }

  return {
    resourceAvailable: result.resource_available,
    hardConflict: result.has_confirmed_conflict,
    softConflict: result.has_pending_conflict,
    alreadyOnWaitingList: result.already_on_waiting_list,
    canJoinWaitingList: result.can_join_waiting_list,
  }
}

export async function reviewBookingRequest(input: {
  bookingId: string
  decision: 'approved' | 'rejected'
  note?: string
}) {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')

  if (!UUID_PATTERN.test(input.bookingId)) {
    throw new Error('This booking request is invalid.')
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, status, resource_id, requester_user_id, institution_id')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (bookingError) throw bookingError
  if (!booking) {
    throw new Error('This booking request could not be found.')
  }

  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('id, owner_user_id, institution_id')
    .eq('id', booking.resource_id)
    .maybeSingle()

  if (resourceError) throw resourceError
  if (!resource || resource.owner_user_id !== user.id) {
    throw new Error('You do not manage this resource.')
  }

  if (booking.status !== 'pending') {
    throw new Error('Only pending requests can be reviewed.')
  }

  if (booking.requester_user_id === user.id) {
    throw new Error('Students cannot approve or reject their own requests.')
  }

  const { error } = await supabase.rpc('review_resource_booking', {
    p_booking_id: input.bookingId,
    p_decision: input.decision,
    p_note: input.note?.trim() || null,
  })

  if (error) {
    throw new Error(toRpcErrorMessage(error))
  }

  revalidatePath('/owner/requests')
  revalidatePath('/owner/dashboard')
  revalidatePath('/student/bookings')
  return { ok: true }
}

export async function cancelBookingRequest(bookingId: string) {
  const { supabase, user } = await requireWorkspaceRole('student')

  if (!UUID_PATTERN.test(bookingId)) {
    throw new Error('This booking is invalid.')
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, requester_user_id, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (bookingError) throw bookingError
  if (!booking || booking.requester_user_id !== user.id) {
    throw new Error('You can only cancel your own bookings.')
  }

  if (!['pending', 'approved'].includes(booking.status)) {
    throw new Error('This booking cannot be cancelled from its current state.')
  }

  const { error } = await supabase.rpc('cancel_resource_booking', { p_booking_id: bookingId })
  if (error) {
    throw new Error(toRpcErrorMessage(error))
  }

  revalidatePath('/student/bookings')
  revalidatePath('/student/dashboard')
  return { ok: true }
}

export async function recordBookingCondition(input: {
  bookingId: string
  phase: 'check_out' | 'check_in'
  rating: 'excellent' | 'good' | 'minor_wear' | 'damaged'
  notes: string
  checklist: string[]
}) {
  if (!input || typeof input !== 'object') {
    throw new Error('The handover report is invalid.')
  }
  const { supabase, user } = await requireAuthenticatedUser()

  if (!UUID_PATTERN.test(input.bookingId)) {
    throw new Error('This booking is invalid.')
  }
  if (
    !['check_out', 'check_in'].includes(input.phase) ||
    !['excellent', 'good', 'minor_wear', 'damaged'].includes(input.rating) ||
    typeof input.notes !== 'string' ||
    input.notes.length > 2000 ||
    !Array.isArray(input.checklist) ||
    input.checklist.length === 0 ||
    input.checklist.length > 100 ||
    input.checklist.some((item) => typeof item !== 'string' || item.trim().length === 0 || item.length > 500)
  ) {
    throw new Error('The handover report is invalid. Review the condition and checklist.')
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, requester_user_id, resource_id, status, institution_id, starts_at')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (bookingError) throw bookingError
  if (!booking) {
    throw new Error('This booking could not be found or you are not authorised to access it.')
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('institution_memberships')
    .select('id')
    .eq('institution_id', booking.institution_id)
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (membershipError) throw membershipError

  const membershipIds = (memberships ?? []).map((membership) => membership.id)
  const { data: roles, error: roleError } = membershipIds.length
    ? await supabase
        .from('institution_membership_roles')
        .select('role')
        .in('membership_id', membershipIds)
        .in('role', ['student', 'resource_owner'])
    : { data: [], error: null }

  if (roleError) throw roleError

  const roleNames = new Set((roles ?? []).map((membershipRole) => membershipRole.role))
  const isEligibleStudent =
    booking.requester_user_id === user.id && roleNames.has('student')
  let isResourceManager = false

  if (!isEligibleStudent && roleNames.has('resource_owner')) {
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('id, owner_user_id, institution_id')
      .eq('id', booking.resource_id)
      .maybeSingle()

    if (resourceError) throw resourceError
    isResourceManager = Boolean(
      resource &&
      resource.owner_user_id === user.id &&
      resource.institution_id === booking.institution_id,
    )
  }

  if (!isEligibleStudent && !isResourceManager) {
    throw new Error('You are not authorised to record a handover report for this booking.')
  }

  if (input.phase === 'check_out' && (booking.status !== 'approved' || new Date(booking.starts_at) > new Date())) {
    throw new Error('Only a due, approved booking can be checked out.')
  }
  if (input.phase === 'check_in' && booking.status !== 'in_use') {
    throw new Error('Only an in-use booking can be checked in.')
  }

  const { error } = await supabase.rpc('record_booking_condition_report', {
    p_booking_id: input.bookingId,
    p_phase: input.phase,
    p_rating: input.rating,
    p_notes: input.notes.trim() || '',
    p_checklist: input.checklist,
  })

  if (error) {
    throw new Error(toRpcErrorMessage(error))
  }

  revalidatePath('/student/bookings')
  revalidatePath('/student/handover')
  revalidatePath('/owner/handover')
  revalidatePath('/owner/requests')
  return { ok: true }
}

export async function joinWaitingListRequest(input: {
  resourceId: string
  startsAt: string
  endsAt: string
}) {
  const { supabase, user } = await requireWorkspaceRole('student')

  if (
    !input ||
    typeof input !== 'object' ||
    typeof input.resourceId !== 'string' ||
    !UUID_PATTERN.test(input.resourceId) ||
    typeof input.startsAt !== 'string' ||
    typeof input.endsAt !== 'string'
  ) {
    throw new Error('The selected resource is invalid.')
  }

  const startsAt = parseUtcDate(input.startsAt)
  const endsAt = parseUtcDate(input.endsAt)
  if (endsAt <= startsAt || startsAt <= new Date()) {
    throw new Error(INVALID_TIME_MESSAGE)
  }

  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('id, listed, institution_id')
    .eq('id', input.resourceId)
    .eq('listed', true)
    .maybeSingle()

  if (resourceError) throw resourceError
  if (!resource) {
    throw new Error('This resource is not available for a waiting list entry.')
  }

  const { data, error } = await supabase.rpc('join_resource_waiting_list', {
    p_resource_id: input.resourceId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
  })

  if (error) {
    if (error.code === '23505' || error.message.toLowerCase().includes('already joined this waiting list')) {
      throw new Error('You are already on the waiting list for this time slot.')
    }
    throw new Error(toRpcErrorMessage(error))
  }

  revalidatePath('/student/bookings')
  revalidatePath('/student/explore')
  if (!data) throw new Error('The waiting-list request did not return an entry reference.')
  return { entryId: data, userId: user.id }
}

export async function cancelWaitingListRequest(entryId: string) {
  const { supabase } = await requireWorkspaceRole('student')

  if (!UUID_PATTERN.test(entryId)) {
    throw new Error('This waiting-list entry is invalid.')
  }

  const { error } = await supabase.rpc('cancel_resource_waiting_list', {
    p_entry_id: entryId,
  })

  if (error) {
    throw new Error(toRpcErrorMessage(error))
  }

  revalidatePath('/student/bookings')
  revalidatePath('/student/activity')
  return { ok: true }
}
