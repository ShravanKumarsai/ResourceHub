import { ResourceDetail } from '@/components/resource/resource-detail'
import { getListedResource } from '@/lib/resources/queries'

export default async function StudentResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resource = await getListedResource(id)
  return (
    <ResourceDetail
      resource={resource}
      mode="student"
      listHref="/student/explore"
      listLabel="Explore resources"
      bookingsHref="/student/bookings"
      embedded
    />
  )
}
