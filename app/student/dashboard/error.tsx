'use client'

import { DashboardErrorFallback } from '@/components/dashboard/dashboard-state'

export default function StudentDashboardError({ reset }: { reset: () => void }) {
  return <DashboardErrorFallback reset={reset} />
}
