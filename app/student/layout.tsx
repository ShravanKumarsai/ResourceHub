import { AppShell } from '@/components/app/app-shell'
import { requireWorkspaceRole } from '@/lib/auth/workspace'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireWorkspaceRole('student')
  return <AppShell role="student" userId={user.id}>{children}</AppShell>
}
