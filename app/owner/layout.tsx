import { AppShell } from '@/components/app/app-shell'
import { getAccountIdentity } from '@/lib/auth/identity'
import { requireWorkspaceRole } from '@/lib/auth/workspace'

export const dynamic = 'force-dynamic'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  const identity = await getAccountIdentity(supabase, user)
  return (
    <AppShell role="owner" userId={user.id} identity={identity}>
      {children}
    </AppShell>
  )
}
