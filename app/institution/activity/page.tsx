import type { Metadata } from 'next'
import { ActivityView } from '@/components/app/activity-view'

export const metadata: Metadata = { title: 'Institution activity history' }

export default function Page() {
  return <ActivityView role="institution" />
}
