import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResourceCatalogue } from '@/components/explore/resource-catalogue'
import { PageHeader } from '@/components/page-header'
import { listActiveInstitutionNames, listListedResources } from '@/lib/resources/queries'

export const metadata: Metadata = { title: 'Explore resources' }

export default async function StudentExplorePage() {
  const [resources, institutions] = await Promise.all([
    listListedResources(),
    listActiveInstitutionNames(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explore resources"
        description="Find shared equipment and spaces across participating institutions, then request a session."
      />
      <Suspense fallback={<div className="text-ink-muted text-sm">Loading resources…</div>}>
        <ResourceCatalogue basePath="/student/explore" resources={resources} institutions={institutions} />
      </Suspense>
    </div>
  )
}
