'use client'

import { DashboardErrorFallback } from '@/components/dashboard/dashboard-state'

export default function OwnerDashboardError({ reset }: { reset: () => void }) {
  return <DashboardErrorFallback reset={reset} />
}
