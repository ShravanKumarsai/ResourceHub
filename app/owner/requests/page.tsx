import type { Metadata } from 'next'
import { WorkspaceDemoNotice } from '@/components/app/workspace-demo-notice'
import { OwnerRequests } from '@/components/owner/owner-requests'

export const metadata: Metadata = { title: 'Booking requests' }

export default function Page() {
  return (
    <>
      <WorkspaceDemoNotice />
      <OwnerRequests />
    </>
  )
}
