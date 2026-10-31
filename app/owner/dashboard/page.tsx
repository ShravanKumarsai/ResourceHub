import type { Metadata } from 'next'
import { OwnerDashboard } from '@/components/owner/owner-dashboard'

export const metadata: Metadata = { title: 'Owner overview' }

export default function Page() {
  return <OwnerDashboard />
}
