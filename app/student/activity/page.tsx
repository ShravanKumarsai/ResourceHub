import type { Metadata } from 'next'
import { ActivityView } from '@/components/app/activity-view'
import { getOperationalActivity } from '@/lib/queries/operational'

export const metadata: Metadata = { title: 'Activity history' }

export default async function Page() {
  const activity = await getOperationalActivity('student')
  return <ActivityView role="student" activity={activity} />
}
