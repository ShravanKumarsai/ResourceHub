import type { Metadata } from 'next'
import { WorkspaceDemoNotice } from '@/components/app/workspace-demo-notice'
import { HandoverView } from '@/components/app/handover-view'

export const metadata: Metadata = { title: 'Check-in / Check-out' }

export default function Page() {
  return (
    <>
      <WorkspaceDemoNotice />
      <HandoverView role="owner" />
    </>
  )
}
