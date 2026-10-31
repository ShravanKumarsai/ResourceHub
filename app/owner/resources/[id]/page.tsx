import type { Metadata } from 'next'
import { EditResource } from '@/components/owner/edit-resource'
import { getOwnedResource, listResourceCategories, listResourceOwnerMemberships } from '@/lib/resources/queries'

export const metadata: Metadata = { title: 'Edit resource' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [resource, ownerMemberships, resourceCategories] = await Promise.all([
    getOwnedResource(id),
    listResourceOwnerMemberships(),
    listResourceCategories(),
  ])
  return <EditResource resource={resource} ownerMemberships={ownerMemberships} resourceCategories={resourceCategories} />
}
