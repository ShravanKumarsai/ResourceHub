import 'server-only'
import { redirect } from 'next/navigation'
import { requireAuthenticatedUser } from '@/lib/auth/server'

export type WorkspaceId = 'student' | 'resource_manager' | 'institution_admin'
export type WorkspaceAccessStatus = 'authorized' | 'pending' | 'rejected' | 'denied'

const WORKSPACE_ROLE: Record<WorkspaceId, string> = {
  student: 'student',
  resource_manager: 'resource_owner',
  institution_admin: 'institution_admin',
}

interface MembershipAccessRow {
  status: string
  requested_role: string | null
  institution_membership_roles: { role: string }[]
}

export async function getWorkspaceAccess(
  supabase: Awaited<ReturnType<typeof requireAuthenticatedUser>>['supabase'],
  userId: string,
  workspace: WorkspaceId,
): Promise<WorkspaceAccessStatus> {
  const { data, error } = await supabase
    .from('institution_memberships')
    .select(
      'status, requested_role, institution_membership_roles(role), institutions!inner(is_active)',
    )
    .eq('user_id', userId)
    .eq('institutions.is_active', true)

  if (error) throw error

  const memberships = (data ?? []) as unknown as MembershipAccessRow[]
  const role = WORKSPACE_ROLE[workspace]
  if (
    memberships.some(
      (membership) =>
        membership.status === 'active' &&
        membership.institution_membership_roles.some(
          (membershipRole) => membershipRole.role === role,
        ),
    )
  ) {
    return 'authorized'
  }

  if (
    workspace !== 'institution_admin' &&
    memberships.some(
      (membership) =>
        membership.status === 'pending' && membership.requested_role === role,
    )
  ) {
    return 'pending'
  }

  if (
    workspace !== 'institution_admin' &&
    memberships.some(
      (membership) =>
        membership.status === 'rejected' && membership.requested_role === role,
    )
  ) {
    return 'rejected'
  }

  return 'denied'
}

export async function requireWorkspaceRole(
  workspace: 'student' | 'resource_manager',
) {
  const { supabase, user } = await requireAuthenticatedUser()
  const status = await getWorkspaceAccess(supabase, user.id, workspace)

  if (status !== 'authorized') {
    redirect(`/auth/workspace?workspace=${workspace}&access=${status}`)
  }

  return { supabase, user }
}
