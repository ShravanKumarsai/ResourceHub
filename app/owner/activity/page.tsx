import type { Metadata } from 'next'
import { WorkspaceDemoNotice } from '@/components/app/workspace-demo-notice'
import { ActivityView } from '@/components/app/activity-view'

export const metadata: Metadata = { title: 'Activity history' }

export default function Page() {
  return (
    <>
      <WorkspaceDemoNotice />
      <ActivityView role="owner" />
    </>
  )
}
