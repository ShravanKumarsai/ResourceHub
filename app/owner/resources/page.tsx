import type { Metadata } from 'next'
import { OwnerResources } from '@/components/owner/owner-resources'
import { listOwnedResources } from '@/lib/resources/queries'

export const metadata: Metadata = { title: 'My resources' }

export default async function Page() {
  const resources = await listOwnedResources()
  return <OwnerResources resources={resources} />
}
