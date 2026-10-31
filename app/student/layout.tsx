import { AppShell } from '@/components/app/app-shell'
import { getAccountIdentity } from '@/lib/auth/identity'
import { requireWorkspaceRole } from '@/lib/auth/workspace'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireWorkspaceRole('student')
  const identity = await getAccountIdentity(supabase, user)
  return (
    <AppShell role="student" userId={user.id} identity={identity}>
      {children}
    </AppShell>
  )
}
