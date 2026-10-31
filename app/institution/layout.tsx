import { AppShell } from '@/components/app/app-shell'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'

export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireInstitutionAdmin()
  return <AppShell role="institution" userId={user.id}>{children}</AppShell>
}
