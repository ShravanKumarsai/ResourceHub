'use client'

import { DashboardErrorFallback } from '@/components/dashboard/dashboard-state'

export default function InstitutionDashboardError({ reset }: { reset: () => void }) {
  return <DashboardErrorFallback reset={reset} />
}
