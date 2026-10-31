import 'server-only'

import { requireWorkspaceRole, type WorkspaceId } from '@/lib/auth/workspace'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import { logSupabaseError } from '@/lib/supabase/dev-error'

export type OperationalIncident = {
  id: string
  resourceId: string
  resourceName: string
  reportedById: string
  reportedBy: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'investigating' | 'resolved'
  title: string
  description: string
  createdAt: string
  history: Array<{ by: string; at: string; text: string }>
}

export type OperationalActivity = {
  id: string
  at: string
  type: string
  text: string
}

export async function getOperationalIncidents(role: 'student' | 'owner') {
  const workspace: WorkspaceId = role === 'student' ? 'student' : 'resource_manager'
  const { supabase, user } = await requireWorkspaceRole(workspace)
  const query = supabase
    .from('incidents')
    .select('id, resource_id, reporter_user_id, severity, status, title, description, created_at, resources(name, owner_user_id)')
    .order('created_at', { ascending: false })

  const { data, error } = await (role === 'student'
    ? query.eq('reporter_user_id', user.id)
    : query.eq('resources.owner_user_id', user.id))

  if (error) {
    logSupabaseError('Loading incidents failed', error)
    return []
  }

  return (data ?? []).map((row) => {
    const resource = Array.isArray(row.resources) ? row.resources[0] : row.resources
    const fallback = role === 'student' ? 'Student' : 'Resource owner'
    const reporter = fallback
    const events: Array<{ actor_id: string; note: string | null; to_status: string; created_at: string }> = []
    return {
      id: row.id,
      resourceId: row.resource_id,
      resourceName: resource?.name ?? 'Resource',
      reportedById: row.reporter_user_id,
      reportedBy: reporter,
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      createdAt: row.created_at,
      history: events.map((event) => ({
        by: event.actor_id === user.id ? 'You' : 'Workspace member',
        at: event.created_at,
        text: event.note || `Status changed to ${event.to_status}.`,
      })),
    } as OperationalIncident
  })
}

export async function getIncidentResources(role: 'student' | 'owner') {
  const { supabase, user } = await requireWorkspaceRole(role === 'student' ? 'student' : 'resource_manager')
  if (role === 'owner') {
    const { data } = await supabase.from('resources').select('id, name').eq('owner_user_id', user.id).order('name')
    return data ?? []
  }
  const { data } = await supabase
    .from('resources')
    .select('id, name, bookings!inner(id, requester_user_id)')
    .eq('bookings.requester_user_id', user.id)
    .order('name')
  return (data ?? []).map(({ id, name }) => ({ id, name }))
}

export async function getOperationalActivity(role: 'student' | 'owner') {
  const { supabase, user } = await requireWorkspaceRole(role === 'student' ? 'student' : 'resource_manager')
  const query = supabase
    .from('activity_events')
    .select('id, actor_id, event_type, summary, created_at, resources(owner_user_id)')
    .order('created_at', { ascending: false })
    .limit(200)

  const { data, error } = await (role === 'student'
    ? query.eq('actor_id', user.id)
    : query.eq('resources.owner_user_id', user.id))

  if (error) {
    logSupabaseError('Loading activity failed', error)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    at: row.created_at,
    type: row.event_type,
    text: row.summary,
  })) as OperationalActivity[]
}

export async function getInstitutionIncidents() {
  const { supabase, institution } = await requireInstitutionAdmin()
  const { data, error } = await supabase
    .from('incidents')
    .select('id, resource_id, reporter_user_id, severity, status, title, description, created_at, resources(name), profiles!incidents_reporter_user_id_fkey(display_name), incident_events(actor_id, from_status, to_status, note, created_at)')
    .eq('institution_id', institution.id)
    .order('created_at', { ascending: false })

  if (error) {
    logSupabaseError('Loading institution incidents failed', error)
    return []
  }

  return (data ?? []).map((row) => {
    const resource = Array.isArray(row.resources) ? row.resources[0] : row.resources
    return {
      id: row.id,
      resourceId: row.resource_id,
      resourceName: resource?.name ?? 'Resource',
      reportedById: row.reporter_user_id,
      reportedBy: 'Workspace member',
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      createdAt: row.created_at,
      history: [],
    } as OperationalIncident
  })
}
