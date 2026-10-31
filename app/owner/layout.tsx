import { AppShell } from '@/components/app/app-shell'
import { requireWorkspaceRole } from '@/lib/auth/workspace'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireWorkspaceRole('resource_manager')
  return <AppShell role="owner" userId={user.id}>{children}</AppShell>
}
