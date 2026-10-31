import type { Metadata } from 'next'
import { IncidentsView } from '@/components/app/incidents-view'
import { getIncidentResources, getOperationalIncidents } from '@/lib/queries/operational'

export const metadata: Metadata = { title: 'Incident reports' }

export default async function Page() {
  const [incidents, resources] = await Promise.all([getOperationalIncidents('student'), getIncidentResources('student')])
  return <IncidentsView role="student" incidents={incidents} resources={resources} />
}
