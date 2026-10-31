import { AppShell } from '@/components/app/app-shell'
import { getAccountIdentity } from '@/lib/auth/identity'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'

export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, institution } = await requireInstitutionAdmin()
  const identity = await getAccountIdentity(supabase, user, institution.name)
  return (
    <AppShell role="institution" userId={user.id} identity={identity}>
      {children}
    </AppShell>
  )
}
