'use server'

import { requireWorkspaceRole } from '@/lib/auth/workspace'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import type { IncidentViewRole } from '@/lib/incident-types'

const PAGE_SIZE = 30

function workspaceForRole(role: unknown): IncidentViewRole {
  if (role === 'student' || role === 'owner' || role === 'institution') return role
  throw new Error('The requested activity workspace is invalid.')
}

export async function loadActivityPage(requestedRole: unknown, requestedPage: unknown) {
  const role = workspaceForRole(requestedRole)
  if (
    typeof requestedPage !== 'number' ||
    !Number.isSafeInteger(requestedPage) ||
    requestedPage < 0 ||
    requestedPage > 10000
  ) {
    throw new Error('The activity page number is invalid.')
  }

  let supabase: Awaited<ReturnType<typeof requireWorkspaceRole>>['supabase']
  let user: Awaited<ReturnType<typeof requireWorkspaceRole>>['user']
  let institutionId: string | null = null
  if (role === 'institution') {
    const access = await requireInstitutionAdmin()
    supabase = access.supabase
    user = access.user
    institutionId = access.institution.id
  } else {
    const access = await requireWorkspaceRole(
      role === 'student' ? 'student' : 'resource_manager',
    )
    supabase = access.supabase
    user = access.user
  }
  const start = requestedPage * PAGE_SIZE
  let query = supabase
    .from('activity_events')
    .select(
      'id, actor_id, resource_id, booking_id, incident_id, event_type, summary, created_at',
    )
  if (institutionId) {
    query = query.eq('institution_id', institutionId)
  }
  const result = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + PAGE_SIZE)

  if (result.error) throw result.error

  const rows = result.data ?? []
  const pageRows = rows.slice(0, PAGE_SIZE)
  const resourceIds = [
    ...new Set(
      pageRows.flatMap((event) => (event.resource_id ? [event.resource_id] : [])),
    ),
  ]
  const bookingIds = [
    ...new Set(
      pageRows.flatMap((event) => (event.booking_id ? [event.booking_id] : [])),
    ),
  ]

  const [resourcesResult, bookingsResult] = await Promise.all([
    resourceIds.length
      ? supabase.from('resources').select('id, name').in('id', resourceIds)
      : Promise.resolve({ data: [], error: null }),
    bookingIds.length
      ? supabase
          .from('bookings')
          .select('id, starts_at, ends_at')
          .in('id', bookingIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (resourcesResult.error) throw resourcesResult.error
  if (bookingsResult.error) throw bookingsResult.error

  const resourceNames = new Map(
    (resourcesResult.data ?? []).map((resource) => [resource.id, resource.name]),
  )
  const bookings = new Map(
    (bookingsResult.data ?? []).map((booking) => [booking.id, booking]),
  )

  return {
    events: pageRows.map((event) => {
      const booking = event.booking_id ? bookings.get(event.booking_id) : undefined
      return {
        id: event.id,
        eventType: event.event_type,
        summary: event.summary,
        createdAt: event.created_at,
        actor: event.actor_id
          ? event.actor_id === user.id
            ? 'You'
            : `Institution member (${event.actor_id.slice(0, 8)})`
          : 'System',
        resourceName: event.resource_id
          ? resourceNames.get(event.resource_id) ?? `Resource (${event.resource_id.slice(0, 8)})`
          : null,
        incidentId: event.incident_id,
        booking: booking
          ? {
              id: booking.id,
              startsAt: booking.starts_at,
              endsAt: booking.ends_at,
            }
          : null,
      }
    }),
    hasMore: rows.length > PAGE_SIZE,
  }
}
