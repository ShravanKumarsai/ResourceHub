import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { ResourceForm } from '@/components/owner/resource-form'
import { EmptyState } from '@/components/page-header'
import { buttonVariants } from '@/components/ui/button'
import type { Resource, ResourceOwnerMembership } from '@/lib/types'

export function EditResource({
  resource,
  ownerMemberships,
  resourceCategories,
}: {
  resource: Resource | null
  ownerMemberships: ResourceOwnerMembership[]
  resourceCategories?: string[]
}) {
  if (!resource) {
    return (
      <EmptyState
        icon={SearchX}
        title="Resource not found"
        description="This resource does not exist or has been removed."
        action={
          <Link href="/owner/resources" className={buttonVariants()}>
            Back to my resources
          </Link>
        }
      />
    )
  }
  return <ResourceForm resource={resource} ownerMemberships={ownerMemberships} resourceCategories={resourceCategories} />
}
