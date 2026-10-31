import { ProfileEditor } from '@/components/app/profile-editor'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import { requireWorkspaceRole } from '@/lib/auth/workspace'
import { resolveDisplayName } from '@/lib/identity'
import { ROLE_LABEL } from '@/lib/nav'
import type { Role } from '@/lib/types'

const MEMBERSHIP_ROLE_LABEL: Record<string, string> = {
  student: 'Student / researcher',
  resource_owner: 'Resource owner',
  institution_admin: 'Institution admin',
}

interface MembershipRow {
  id: string
  status: string
  institutions: { name: string } | { name: string }[] | null
  institution_membership_roles: { role: string }[]
}

function countOrDash(result: { count: number | null; error: unknown }) {
  return result.error ? '—' : (result.count ?? 0)
}

export async function ProfileView({ role }: { role: Role }) {
  const { supabase, user, institution } =
    role === 'institution'
      ? await requireInstitutionAdmin()
      : { ...(await requireWorkspaceRole(role === 'student' ? 'student' : 'resource_manager')), institution: null }

  const [profileResult, membershipsResult, statResults] = await Promise.all([
    supabase.from('profiles').select('display_name, title, department').eq('id', user.id).maybeSingle(),
    supabase
      .from('institution_memberships')
      .select('id, status, institutions(name), institution_membership_roles(role)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    loadStats(),
  ])

  async function loadStats() {
    if (role === 'student') {
      const [total, approved, incidents] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('requester_user_id', user.id),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('requester_user_id', user.id)
          .eq('status', 'approved'),
        supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('reporter_user_id', user.id),
      ])
      return { total, approved, incidents }
    }
    if (role === 'owner') {
      const resources = await supabase
        .from('resources')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', user.id)
      return { resources }
    }
    const [active, pending] = await Promise.all([
      supabase
        .from('institution_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institution!.id)
        .eq('status', 'active'),
      supabase
        .from('institution_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institution!.id)
        .eq('status', 'pending'),
    ])
    return { active, pending }
  }

  const profile = profileResult.data
  const memberships = (membershipsResult.data ?? []) as unknown as MembershipRow[]
  const activeMembership = memberships.find((membership) => membership.status === 'active')
  const embedded = activeMembership?.institutions
  const membershipInstitutionName = Array.isArray(embedded) ? embedded[0]?.name : embedded?.name
  const institutionName = institution?.name ?? membershipInstitutionName ?? 'Not linked'
  const roleNames = (activeMembership?.institution_membership_roles ?? []).map(
    (membershipRole) => MEMBERSHIP_ROLE_LABEL[membershipRole.role] ?? membershipRole.role,
  )

  const fallbackName = resolveDisplayName({
    metadata: user.user_metadata,
    email: user.email,
  })

  let statCards: Array<{ label: string; value: number | string; hint: string }>
  if (role === 'student') {
    const stats = statResults as Awaited<ReturnType<typeof loadStats>> & {
      total: { count: number | null; error: unknown }
      approved: { count: number | null; error: unknown }
      incidents: { count: number | null; error: unknown }
    }
    statCards = [
      { label: 'Bookings made', value: countOrDash(stats.total), hint: 'Across your activity' },
      { label: 'Approved', value: countOrDash(stats.approved), hint: 'Confirmed sessions' },
      { label: 'Incidents', value: countOrDash(stats.incidents), hint: 'Logged to date' },
    ]
  } else if (role === 'owner') {
    const stats = statResults as { resources: { count: number | null; error: unknown } }
    statCards = [
      { label: 'Resources', value: countOrDash(stats.resources), hint: 'Managed in your workspace' },
      { label: 'Status', value: activeMembership ? 'Active' : 'Pending', hint: 'Current membership state' },
      { label: 'Institution', value: institutionName, hint: 'Primary organisation' },
    ]
  } else {
    const stats = statResults as {
      active: { count: number | null; error: unknown }
      pending: { count: number | null; error: unknown }
    }
    statCards = [
      { label: 'Active members', value: countOrDash(stats.active), hint: 'In your institution' },
      { label: 'Pending requests', value: countOrDash(stats.pending), hint: 'Awaiting review' },
      { label: 'Institution', value: institutionName, hint: 'Primary organisation' },
    ]
  }

  const accountRows: Array<[string, string]> = [
    ['Full name', profile?.display_name?.trim() || fallbackName],
    ['Email', user.email ?? 'Unknown'],
    ['Role', ROLE_LABEL[role]],
    ['Title', profile?.title ?? 'Not set'],
    ['Institution', institutionName],
    ['Department', profile?.department ?? 'Not set'],
  ]

  const otherWorkspace =
    role === 'student'
      ? { label: 'Open resource owner workspace', href: '/owner/dashboard' }
      : role === 'owner'
        ? { label: 'Open student workspace', href: '/student/dashboard' }
        : null

  return (
    <ProfileEditor
      userEmail={user.email ?? ''}
      initialProfile={{
        display_name: profile?.display_name ?? null,
        title: profile?.title ?? null,
        department: profile?.department ?? null,
      }}
      fallbackName={fallbackName}
      roleLabel={ROLE_LABEL[role]}
      institutionName={institutionName}
      roleNames={roleNames}
      statCards={statCards}
      accountRows={accountRows}
      otherWorkspace={otherWorkspace}
    />
  )
}
