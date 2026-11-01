import type { Metadata } from 'next'
import { InstitutionDashboard } from '@/components/institution/institution-dashboard'
import { getInstitutionDashboardData } from '@/lib/institution/dashboard-queries'

export const metadata: Metadata = { title: 'Institution dashboard' }

export default async function InstitutionDashboardPage() {
  const dashboard = await getInstitutionDashboardData()
  return (
    <InstitutionDashboard
      {...dashboard}
    />
  )
}
