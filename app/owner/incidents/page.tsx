import type { Metadata } from 'next'
import { IncidentsView } from '@/components/app/incidents-view'

export const metadata: Metadata = { title: 'Incident management' }

export default function Page() {
  return <IncidentsView role="owner" />
}
