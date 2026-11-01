import type { Metadata } from 'next'
import { OwnerRequests } from '@/components/owner/owner-requests'

export const metadata: Metadata = { title: 'Booking requests' }

export default function Page() {
  return <OwnerRequests />
}
