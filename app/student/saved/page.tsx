import type { Metadata } from 'next'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/page-header'
import { ResourceCard } from '@/components/resource-card'
import { buttonVariants } from '@/components/ui/button'
import { listMySavedResources } from '@/lib/resources/queries'

export const metadata: Metadata = { title: 'Saved resources' }

export default async function SavedResourcesPage() {
  const resources = await listMySavedResources()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved resources"
        description="Keep a personal list of resources you may want to book."
        actions={
          <Link href="/student/explore" className={buttonVariants({ variant: 'outline' })}>
            Explore resources
          </Link>
        }
      />
      {resources.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              href={`/student/explore/${resource.id}`}
              showFavorite
              initialSaved
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bookmark}
          title="No saved resources yet"
          description="Save a resource from its details or a catalogue card. Resources that are unlisted or archived are hidden from this list."
          action={
            <Link href="/student/explore" className={buttonVariants()}>
              Explore resources
            </Link>
          }
        />
      )}
    </div>
  )
}
