import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ResourceCatalogue } from '@/components/explore/resource-catalogue'
import { PageHeader } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import {
  listActiveInstitutionNames,
  listListedResources,
  listMyFavoriteResourceIds,
} from '@/lib/resources/queries'

export const metadata: Metadata = { title: 'Explore resources' }

export default async function StudentExplorePage() {
  const [resources, institutions, savedResourceIds] = await Promise.all([
    listListedResources(),
    listActiveInstitutionNames(),
    listMyFavoriteResourceIds(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explore resources"
        description="Find shared equipment and spaces across participating institutions, then request a session."
        actions={
          <Link href="/student/saved" className={buttonVariants({ variant: 'outline' })}>
            Saved resources
          </Link>
        }
      />
      <Suspense fallback={<div className="text-ink-muted text-sm">Loading resources…</div>}>
        <ResourceCatalogue
          basePath="/student/explore"
          resources={resources}
          institutions={institutions}
          savedResourceIds={savedResourceIds}
        />
      </Suspense>
    </div>
  )
}
