import type { Metadata } from 'next'
import { IncidentsView } from '@/components/app/incidents-view'
import { getIncidentResources, getOperationalIncidents } from '@/lib/queries/operational'

export const metadata: Metadata = { title: 'Incident management' }

export default async function Page() {
  const [incidents, resources] = await Promise.all([getOperationalIncidents('owner'), getIncidentResources('owner')])
  return <IncidentsView role="owner" incidents={incidents} resources={resources} />
}
