import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResourceCatalogue } from '@/components/explore/resource-catalogue'
import { PageHeader } from '@/components/page-header'
import {
  listActiveInstitutionNames,
  listListedResources,
  listMyFavoriteResourceIds,
} from '@/lib/resources/queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Explore resources',
  description:
    'Search laboratory equipment, workshops, and computing resources shared across participating institutions.',
}

export default async function ExplorePage() {
  const [resources, institutions, savedResourceIds] = await Promise.all([
    listListedResources(),
    listActiveInstitutionNames(),
    listMyFavoriteResourceIds(),
  ])
  return (
    <div className="container-page py-10 lg:py-14">
      <PageHeader
        title="Explore resources"
        description="Search shared equipment and spaces across participating institutions. Filter by category, institution, availability, and cost."
      />
      <div className="mt-8">
        <Suspense fallback={<div className="text-ink-muted text-sm">Loading resources…</div>}>
          <ResourceCatalogue
            basePath="/resources"
            resources={resources}
            institutions={institutions}
            savedResourceIds={savedResourceIds}
          />
        </Suspense>
      </div>
    </div>
  )
}
