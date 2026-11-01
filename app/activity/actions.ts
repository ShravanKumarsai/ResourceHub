'use server'

import { requireWorkspaceRole } from '@/lib/auth/workspace'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import type { IncidentViewRole } from '@/lib/incident-types'

const PAGE_SIZE = 30
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/

type ActivitySource = 'activity' | 'membership'
type ActivityCursor = {
  createdAt: string
  source: ActivitySource
  rowId: string
}

type TimelineEvent = {
  id: string
  source: ActivitySource
  createdAt: string
  eventType: string
  summary: string
  actor: string
  resourceId: string | null
  bookingId: string | null
  incidentId: string | null
}

function workspaceForRole(role: unknown): IncidentViewRole {
  if (role === 'student' || role === 'owner' || role === 'institution') return role
  throw new Error('The requested activity workspace is invalid.')
}

function decodeCursor(value: unknown): ActivityCursor | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > 512) {
    throw new Error('The activity cursor is invalid.')
  }

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value))
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('createdAt' in parsed) ||
      !('source' in parsed) ||
      !('rowId' in parsed) ||
      typeof parsed.createdAt !== 'string' ||
      !TIMESTAMP_PATTERN.test(parsed.createdAt) ||
      !Number.isFinite(Date.parse(parsed.createdAt)) ||
      (parsed.source !== 'activity' && parsed.source !== 'membership') ||
      typeof parsed.rowId !== 'string' ||
      !UUID_PATTERN.test(parsed.rowId)
    ) {
      throw new Error('The activity cursor is invalid.')
    }

    return {
      createdAt: parsed.createdAt,
      source: parsed.source,
      rowId: parsed.rowId,
    }
  } catch {
    throw new Error('The activity cursor is invalid.')
  }
}

function encodeCursor(event: TimelineEvent) {
  return encodeURIComponent(JSON.stringify({
    createdAt: event.createdAt,
    source: event.source,
    rowId: event.id.slice(event.source.length + 1),
  } satisfies ActivityCursor))
}

function compareSubMillisecondPrecision(timestamp: string) {
  const fraction = timestamp.match(/\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/)?.[1] ?? ''
  return Number(fraction.padEnd(6, '0').slice(3, 6) || 0)
}

function compareTimelineEvents(left: TimelineEvent, right: TimelineEvent) {
  const leftTime = Date.parse(left.createdAt)
  const rightTime = Date.parse(right.createdAt)
  if (leftTime !== rightTime) return rightTime - leftTime

  const leftPrecision = compareSubMillisecondPrecision(left.createdAt)
  const rightPrecision = compareSubMillisecondPrecision(right.createdAt)
  if (leftPrecision !== rightPrecision) return rightPrecision - leftPrecision

  if (left.id === right.id) return 0
  return left.id > right.id ? -1 : 1
}

function labelActor(actorId: string | null, currentUserId: string) {
  if (!actorId) return 'System'
  return actorId === currentUserId
    ? 'You'
    : `Institution member (${actorId.slice(0, 8)})`
}

function membershipEventSummary(event: {
  action: string
  to_status: string
  to_roles: string[]
}) {
  if (event.action === 'account_anonymized') {
    return 'A membership account was anonymized.'
  }
  if (event.action === 'initial_admin_provisioned') {
    return 'Initial institution administrator provisioned.'
  }
  if (event.action === 'administrator_transfer') {
    return 'Institution administrator transfer recorded.'
  }

  const roles = event.to_roles.length
    ? ` Roles: ${event.to_roles.map((role) => role.replace(/_/g, ' ')).join(', ')}.`
    : ''
  return `Membership ${event.to_status.replace(/_/g, ' ')}.${roles}`
}

function applyActivityCursor<T extends {
  or: (filters: string) => T
  lte: (column: string, value: string) => T
}>(
  query: T,
  source: ActivitySource,
  cursor: ActivityCursor | null,
) {
  if (!cursor) return query

  if (cursor.source === source) {
    return query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.rowId})`,
    )
  }

  if (source === 'activity' && cursor.source === 'membership') {
    return query.lte('created_at', cursor.createdAt)
  }

  return query.or(`created_at.lt.${cursor.createdAt}`)
}

export async function loadActivityPage(
  requestedRole: unknown,
  requestedCursor: unknown = null,
) {
  const role = workspaceForRole(requestedRole)
  const cursor = decodeCursor(requestedCursor)

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

  let activityQuery = supabase
    .from('activity_events')
    .select(
      'id, actor_id, resource_id, booking_id, incident_id, event_type, summary, created_at',
    )
  if (institutionId) activityQuery = activityQuery.eq('institution_id', institutionId)
  activityQuery = applyActivityCursor(activityQuery, 'activity', cursor)

  let membershipQuery = supabase
    .from('institution_membership_events')
    .select(
      'id, actor_id, action, actor_kind, from_status, to_status, from_roles, to_roles, created_at',
    )
  if (institutionId) membershipQuery = membershipQuery.eq('institution_id', institutionId)
  membershipQuery = applyActivityCursor(membershipQuery, 'membership', cursor)

  const [activityResult, membershipResult] = await Promise.all([
    activityQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1),
    membershipQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1),
  ])

  if (activityResult.error) throw activityResult.error
  if (membershipResult.error) throw membershipResult.error

  const activityRows = activityResult.data ?? []
  const membershipRows = membershipResult.data ?? []
  const merged: TimelineEvent[] = [
    ...activityRows.map((event) => ({
      id: `activity:${event.id}`,
      source: 'activity' as const,
      createdAt: event.created_at,
      eventType: event.event_type,
      summary: event.summary,
      actor: labelActor(event.actor_id, user.id),
      resourceId: event.resource_id,
      bookingId: event.booking_id,
      incidentId: event.incident_id,
    })),
    ...membershipRows.map((event) => ({
      id: `membership:${event.id}`,
      source: 'membership' as const,
      createdAt: event.created_at,
      eventType: `membership_${event.action}`,
      summary: membershipEventSummary(event),
      actor: event.actor_kind === 'system' || event.actor_kind === 'operator'
        ? 'System'
        : labelActor(event.actor_id, user.id),
      resourceId: null,
      bookingId: null,
      incidentId: null,
    })),
  ].sort(compareTimelineEvents)

  const pageRows = merged.slice(0, PAGE_SIZE)
  const hasMore = merged.length > PAGE_SIZE
  const resourceIds = [
    ...new Set(pageRows.flatMap((event) => event.resourceId ? [event.resourceId] : [])),
  ]
  const bookingIds = [
    ...new Set(pageRows.flatMap((event) => event.bookingId ? [event.bookingId] : [])),
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
      const booking = event.bookingId ? bookings.get(event.bookingId) : undefined
      return {
        id: event.id,
        eventType: event.eventType,
        summary: event.summary,
        createdAt: event.createdAt,
        actor: event.actor,
        resourceName: event.resourceId
          ? resourceNames.get(event.resourceId) ?? `Resource (${event.resourceId.slice(0, 8)})`
          : null,
        incidentId: event.incidentId,
        booking: booking
          ? {
              id: booking.id,
              startsAt: booking.starts_at,
              endsAt: booking.ends_at,
            }
          : null,
      }
    }),
    hasMore,
    nextCursor: hasMore && pageRows.length
      ? encodeCursor(pageRows[pageRows.length - 1])
      : null,
  }
}
