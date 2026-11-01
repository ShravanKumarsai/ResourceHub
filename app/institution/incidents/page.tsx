import type { Metadata } from 'next'
import { IncidentsView } from '@/components/app/incidents-view'

export const metadata: Metadata = { title: 'Institution incidents' }

export default function Page() {
  return <IncidentsView role="institution" />
}
