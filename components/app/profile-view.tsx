import { ProfileEditor } from '@/components/app/profile-editor'
import { requireWorkspaceRole } from '@/lib/auth/workspace'
import { ROLE_LABEL } from '@/lib/nav'
import type { Role } from '@/lib/types'

export async function ProfileView({ role }: { role: Role }) {
  const workspace = role === 'student' ? 'student' : 'resource_manager'
  const { supabase, user } = await requireWorkspaceRole(workspace)

  const [profileResult, membershipsResult, bookingsResult, incidentsResult, resourceCountResult] =
    await Promise.all([
      supabase.from('profiles').select('display_name, title, department').eq('id', user.id).maybeSingle(),
      supabase
        .from('institution_memberships')
        .select('id, institution_id, status, requested_role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('id, status, starts_at, ends_at, purpose')
        .eq('requester_user_id', user.id)
        .order('starts_at', { ascending: false })
        .limit(5),
      supabase
        .from('incidents')
        .select('id, status, title, created_at')
        .eq('reporter_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      role === 'owner'
        ? supabase.from('resources').select('id', { count: 'exact', head: true }).eq('owner_user_id', user.id)
        : Promise.resolve({ count: 0, error: null }),
    ])

  const profile = profileResult.data
  const memberships = membershipsResult.data ?? []
  const institutionIds = [...new Set(memberships.map((membership) => membership.institution_id))]
  const institutionMap = new Map<string, string>()

  if (institutionIds.length > 0) {
    const { data: institutions } = await supabase
      .from('institutions')
      .select('id, name')
      .in('id', institutionIds)

    ;(institutions ?? []).forEach((institution) => {
      institutionMap.set(institution.id, institution.name)
    })
  }

  const membershipIds = memberships.map((membership) => membership.id)
  const roleMap = new Map<string, string[]>()
  if (membershipIds.length > 0) {
    const { data: memberRoles } = await supabase
      .from('institution_membership_roles')
      .select('membership_id, role')
      .in('membership_id', membershipIds)

    ;(memberRoles ?? []).forEach((membershipRole) => {
      const existing = roleMap.get(membershipRole.membership_id) ?? []
      existing.push(membershipRole.role)
      roleMap.set(membershipRole.membership_id, existing)
    })
  }

  const bookings = bookingsResult.data ?? []
  const incidents = incidentsResult.data ?? []
  const activeMembership = memberships.find((membership) => membership.status === 'active')
  const institutionName = activeMembership
    ? institutionMap.get(activeMembership.institution_id) ?? 'Institution'
    : 'Not linked'
  const roleNames = activeMembership ? roleMap.get(activeMembership.id) ?? [] : []

  const statCards =
    role === 'student'
      ? [
          { label: 'Bookings made', value: bookings.length, hint: 'Across your recent activity' },
          { label: 'Approved', value: bookings.filter((booking) => booking.status === 'approved').length, hint: 'Confirmed sessions' },
          { label: 'Incidents', value: incidents.length, hint: 'Logged to date' },
        ]
      : [
          { label: 'Resources', value: resourceCountResult.count ?? 0, hint: 'Managed in your workspace' },
          { label: 'Status', value: activeMembership ? 'Active' : 'Pending', hint: 'Current membership state' },
          { label: 'Institution', value: institutionName, hint: 'Primary organisation' },
        ]

  const accountRows: Array<[string, string]> = [
    ['Full name', profile?.display_name ?? user.user_metadata?.full_name ?? user.user_metadata?.display_name ?? 'Not provided'],
    ['Email', user.email ?? 'Unknown'],
    ['Role', ROLE_LABEL[role]],
    ['Title', profile?.title ?? 'Not set'],
    ['Institution', institutionName],
    ['Department', profile?.department ?? 'Not set'],
  ]

  const other: Role = role === 'student' ? 'owner' : 'student'

  return (
    <ProfileEditor
      userId={user.id}
      userEmail={user.email ?? 'member@resourcehub.local'}
      initialProfile={{
        display_name: profile?.display_name ?? null,
        title: profile?.title ?? null,
        department: profile?.department ?? null,
      }}
      role={role}
      roleLabel={ROLE_LABEL[role]}
      institutionName={institutionName}
      roleNames={roleNames}
      statCards={statCards}
      accountRows={accountRows}
      otherRole={other}
      otherHref={`/${other}/dashboard`}
    />
  )
}
