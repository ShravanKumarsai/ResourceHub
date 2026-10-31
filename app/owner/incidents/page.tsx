import type { Metadata } from 'next'
import { WorkspaceDemoNotice } from '@/components/app/workspace-demo-notice'
import { IncidentsView } from '@/components/app/incidents-view'

export const metadata: Metadata = { title: 'Incident management' }

export default function Page() {
  return (
    <>
      <WorkspaceDemoNotice />
      <IncidentsView role="owner" />
    </>
  )
}
