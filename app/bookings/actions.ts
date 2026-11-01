'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspaceRole } from '@/lib/auth/workspace'

const INVALID_TIME_MESSAGE = 'Choose a valid future time range before submitting.'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
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
  if (message.toLowerCase().includes('already')) return 'A matching booking already exists for this request.'
  if (message.toLowerCase().includes('overlap') || message.toLowerCase().includes('conflict')) return 'This time overlaps with an existing approved booking.'
  if (message.toLowerCase().includes('not found')) return 'This booking could not be found.'
  return message || 'The booking action could not be completed. Please try again.'
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
  const { supabase, user } = await requireWorkspaceRole('student')

  if (!UUID_PATTERN.test(input.bookingId)) {
    throw new Error('This booking is invalid.')
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, requester_user_id, resource_id, status, institution_id')
    .eq('id', input.bookingId)
    .maybeSingle()

  if (bookingError) throw bookingError
  if (!booking) {
    throw new Error('This booking could not be found.')
  }

  const { data: resource, error: resourceError } = await supabase
    .from('resources')
    .select('id, owner_user_id, institution_id')
    .eq('id', booking.resource_id)
    .maybeSingle()

  if (resourceError) throw resourceError
  if (!resource) {
    throw new Error('This resource could not be found.')
  }

  const isParticipant = booking.requester_user_id === user.id || resource.owner_user_id === user.id
  if (!isParticipant) {
    throw new Error('You are not authorised to record this handover report.')
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

  if (!UUID_PATTERN.test(input.resourceId)) {
    throw new Error('The selected resource is invalid.')
  }

  const startsAt = parseDate(input.startsAt)
  const endsAt = parseDate(input.endsAt)
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
    throw new Error(toRpcErrorMessage(error))
  }

  revalidatePath('/student/bookings')
  return { entryId: data as string, userId: user.id }
}
