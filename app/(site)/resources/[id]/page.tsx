import type { Metadata } from 'next'
import { ResourceDetail } from '@/components/resource/resource-detail'
import { getListedResource } from '@/lib/resources/queries'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const resource = await getListedResource(id)
  return resource
    ? { title: resource.name, description: resource.description.slice(0, 155) }
    : { title: 'Resource not found' }
}

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resource = await getListedResource(id)
  return <ResourceDetail resource={resource} mode="public" listHref="/explore" listLabel="Explore resources" />
}
