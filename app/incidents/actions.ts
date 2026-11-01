'use server'

import { revalidatePath } from 'next/cache'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import { requireWorkspaceRole } from '@/lib/auth/workspace'
import type {
  IncidentSeverity,
  IncidentStatus,
} from '@/lib/types'
import type {
  IncidentViewRole,
  IncidentWorkspaceBooking,
  IncidentWorkspaceData,
  IncidentWorkspaceRecord,
} from '@/lib/incident-types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const INCIDENT_SEVERITIES: IncidentSeverity[] = ['low', 'medium', 'high', 'critical']
const INCIDENT_STATUSES: IncidentStatus[] = ['open', 'investigating', 'resolved']
const INCIDENT_PAGE_SIZE = 50
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/

type IncidentCursor = {
  createdAt: string
  id: string
}

function workspaceForRole(role: unknown): IncidentViewRole {
  if (role === 'student' || role === 'owner' || role === 'institution') return role
  throw new Error('The requested incident workspace is invalid.')
}

async function requireIncidentWorkspace(role: IncidentViewRole) {
  if (role === 'institution') {
    const { supabase, user, institution } = await requireInstitutionAdmin()
    return { supabase, user, institutionId: institution.id }
  }
  const { supabase, user } = await requireWorkspaceRole(
    role === 'student' ? 'student' : 'resource_manager',
  )
  return { supabase, user, institutionId: null }
}

function labelActor(actorId: string | null, currentUserId: string) {
  if (!actorId) return 'System'
  return actorId === currentUserId
    ? 'You'
    : `Institution member (${actorId.slice(0, 8)})`
}

function incidentEventText(
  fromStatus: string | null,
  toStatus: string,
  note: string,
) {
  if (note.trim()) return note
  if (!fromStatus) return 'Incident reported.'
  return `Status changed from ${fromStatus} to ${toStatus}.`
}

function decodeIncidentCursor(value: unknown): IncidentCursor | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > 512) {
    throw new Error('The incident cursor is invalid.')
  }

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value))
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('createdAt' in parsed) ||
      !('id' in parsed) ||
      typeof parsed.createdAt !== 'string' ||
      !TIMESTAMP_PATTERN.test(parsed.createdAt) ||
      !Number.isFinite(Date.parse(parsed.createdAt)) ||
      typeof parsed.id !== 'string' ||
      !UUID_PATTERN.test(parsed.id)
    ) {
      throw new Error('The incident cursor is invalid.')
    }

    return { createdAt: parsed.createdAt, id: parsed.id }
  } catch {
    throw new Error('The incident cursor is invalid.')
  }
}

export async function loadIncidentWorkspace(
  requestedRole: unknown,
  requestedCursor: unknown = null,
): Promise<IncidentWorkspaceData> {
  const role = workspaceForRole(requestedRole)
  const cursor = decodeIncidentCursor(requestedCursor)
  const { supabase, user, institutionId } = await requireIncidentWorkspace(role)

  let incidentQuery = supabase
    .from('incidents')
    .select(
      'id, resource_id, booking_id, reporter_user_id, severity, status, title, description, created_at',
    )
  if (role === 'institution' && institutionId) {
    incidentQuery = incidentQuery.eq('institution_id', institutionId)
  }
  if (cursor) {
    incidentQuery = incidentQuery.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }
  const incidentResult = await incidentQuery
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(INCIDENT_PAGE_SIZE + 1)

  if (incidentResult.error) throw incidentResult.error

  const fetchedIncidentRows = incidentResult.data ?? []
  const incidentRows = fetchedIncidentRows.slice(0, INCIDENT_PAGE_SIZE)
  const hasMore = fetchedIncidentRows.length > INCIDENT_PAGE_SIZE
  const incidentIds = incidentRows.map((incident) => incident.id)
  const relatedResourceIds = [
    ...new Set(incidentRows.map((incident) => incident.resource_id)),
  ]

  const eventResult = incidentIds.length
    ? await supabase
        .from('incident_events')
        .select('id, incident_id, actor_id, from_status, to_status, note, created_at')
        .in('incident_id', incidentIds)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
    : { data: [], error: null }

  if (eventResult.error) throw eventResult.error

  let reportResources: { id: string; name: string }[] = []
  let reportBookings: IncidentWorkspaceBooking[] = []

  if (role === 'owner') {
    const resourceResult = await supabase
      .from('resources')
      .select('id, name')
      .eq('owner_user_id', user.id)
      .order('name', { ascending: true })
      .limit(INCIDENT_PAGE_SIZE)

    if (resourceResult.error) throw resourceResult.error
    reportResources = resourceResult.data ?? []
    relatedResourceIds.push(
      ...reportResources.map((resource) => resource.id),
    )

    const resourceIds = reportResources.map((resource) => resource.id)
    if (resourceIds.length) {
      const bookingResult = await supabase
        .from('bookings')
        .select('id, resource_id, starts_at, status')
        .in('resource_id', resourceIds)
        .order('starts_at', { ascending: false })
        .limit(INCIDENT_PAGE_SIZE)

      if (bookingResult.error) throw bookingResult.error
      reportBookings = (bookingResult.data ?? []).map((booking) => ({
        id: booking.id,
        resourceId: booking.resource_id,
        startsAt: booking.starts_at,
        status: booking.status,
      }))
    }
  } else if (role === 'student') {
    const bookingResult = await supabase
      .from('bookings')
      .select('id, resource_id, starts_at, status')
      .eq('requester_user_id', user.id)
      .order('starts_at', { ascending: false })
      .limit(INCIDENT_PAGE_SIZE)

    if (bookingResult.error) throw bookingResult.error
    reportBookings = (bookingResult.data ?? []).map((booking) => ({
      id: booking.id,
      resourceId: booking.resource_id,
      startsAt: booking.starts_at,
      status: booking.status,
    }))
    relatedResourceIds.push(
      ...reportBookings.map((booking) => booking.resourceId),
    )
  }

  const resourceIds = [...new Set(relatedResourceIds)]
  const resourceResult = resourceIds.length
    ? await supabase
        .from('resources')
        .select('id, name')
        .in('id', resourceIds)
    : { data: [], error: null }

  if (resourceResult.error) throw resourceResult.error

  const resourceNames = new Map(
    (resourceResult.data ?? []).map((resource) => [resource.id, resource.name]),
  )
  const historyByIncident = new Map<
    string,
    IncidentWorkspaceRecord['history']
  >()

  for (const event of eventResult.data ?? []) {
    const history = historyByIncident.get(event.incident_id) ?? []
    history.push({
      id: event.id,
      at: event.created_at,
      by: labelActor(event.actor_id, user.id),
      text: incidentEventText(
        event.from_status,
        event.to_status,
        event.note,
      ),
    })
    historyByIncident.set(event.incident_id, history)
  }

  return {
    incidents: incidentRows.map((incident) => ({
      id: incident.id,
      resourceId: incident.resource_id,
      bookingId: incident.booking_id,
      reportedById: incident.reporter_user_id,
      reportedBy: labelActor(incident.reporter_user_id, user.id),
      severity: incident.severity as IncidentSeverity,
      status: incident.status as IncidentStatus,
      title: incident.title,
      description: incident.description,
      createdAt: incident.created_at,
      history: historyByIncident.get(incident.id) ?? [],
    })),
    resources: (resourceResult.data ?? []).map((resource) => ({
      id: resource.id,
      name: resourceNames.get(resource.id) ?? resource.name,
    })),
    bookings: reportBookings,
    hasMore,
    nextCursor: hasMore && incidentRows.length
      ? encodeURIComponent(JSON.stringify({
          createdAt: incidentRows[incidentRows.length - 1].created_at,
          id: incidentRows[incidentRows.length - 1].id,
        } satisfies IncidentCursor))
      : null,
  }
}

export async function reportIncident(input: {
  role: unknown
  resourceId: string
  bookingId: string | null
  severity: string
  title: string
  description: string
}) {
  if (!input || typeof input !== 'object') {
    throw new Error('Incident details are invalid.')
  }
  const role = workspaceForRole(input.role)
  if (role === 'institution') {
    throw new Error('Institution administrators do not have permission to create incident reports.')
  }
  const { supabase, user } = await requireIncidentWorkspace(role)

  if (typeof input.resourceId !== 'string' || !UUID_PATTERN.test(input.resourceId)) {
    throw new Error('Choose a valid resource.')
  }
  if (
    input.bookingId !== null &&
    (typeof input.bookingId !== 'string' || !UUID_PATTERN.test(input.bookingId))
  ) {
    throw new Error('Choose a valid booking.')
  }
  if (role === 'student' && !input.bookingId) {
    throw new Error('Choose one of your eligible bookings for this report.')
  }
  if (
    !INCIDENT_SEVERITIES.includes(input.severity as IncidentSeverity) ||
    typeof input.title !== 'string' ||
    input.title.trim().length < 3 ||
    input.title.trim().length > 200 ||
    typeof input.description !== 'string' ||
    input.description.trim().length < 10 ||
    input.description.trim().length > 10000
  ) {
    throw new Error('Incident details are invalid. Check the severity, title, and description.')
  }

  if (input.bookingId) {
    const bookingResult = await supabase
      .from('bookings')
      .select('id, resource_id, requester_user_id')
      .eq('id', input.bookingId)
      .maybeSingle()

    if (bookingResult.error) throw bookingResult.error
    if (!bookingResult.data) {
      throw new Error('The booking was not found or you are not authorised to use it.')
    }
    if (bookingResult.data.resource_id !== input.resourceId) {
      throw new Error('The selected booking does not belong to this resource.')
    }
    if (
      role === 'student' &&
      bookingResult.data.requester_user_id !== user.id
    ) {
      throw new Error('You can report incidents only for your own bookings.')
    }
  }

  const { data, error } = await supabase.rpc('report_resource_incident', {
    p_resource_id: input.resourceId,
    p_booking_id: input.bookingId,
    p_severity: input.severity,
    p_title: input.title.trim(),
    p_description: input.description.trim(),
  })

  if (error) {
    if (error.code === '42501') {
      throw new Error('You are not authorised to report an incident for this resource or booking.')
    }
    if (error.code === '23503') {
      throw new Error('The booking or resource no longer matches this institution.')
    }
    throw new Error(error.message || 'The incident report could not be saved.')
  }

  revalidatePath('/student/incidents')
  revalidatePath('/owner/incidents')
  revalidatePath('/student/activity')
  revalidatePath('/owner/activity')
  return { incidentId: data }
}

export async function updateIncident(input: {
  incidentId: string
  status: string
  note: string
}) {
  if (!input || typeof input !== 'object') {
    throw new Error('Incident update is invalid.')
  }
  const { supabase } = await requireWorkspaceRole('resource_manager')

  if (
    typeof input.incidentId !== 'string' ||
    !UUID_PATTERN.test(input.incidentId) ||
    !INCIDENT_STATUSES.includes(input.status as IncidentStatus) ||
    typeof input.note !== 'string' ||
    input.note.trim().length > 2000
  ) {
    throw new Error('Incident update is invalid.')
  }

  const { error } = await supabase.rpc('update_resource_incident', {
    p_incident_id: input.incidentId,
    p_status: input.status,
    p_note: input.note.trim(),
  })

  if (error) {
    if (error.code === '42501') {
      throw new Error('You are not authorised to manage this resource incident.')
    }
    throw new Error(error.message || 'The incident update could not be saved.')
  }

  revalidatePath('/owner/incidents')
  revalidatePath('/owner/activity')
  revalidatePath('/student/incidents')
  revalidatePath('/student/activity')
  return { ok: true }
}
