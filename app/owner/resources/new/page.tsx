import type { Metadata } from 'next'
import { ResourceForm } from '@/components/owner/resource-form'
import { EmptyState } from '@/components/page-header'
import { Building2 } from 'lucide-react'
import { listResourceCategories, listResourceOwnerMemberships } from '@/lib/resources/queries'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Add a resource' }

export default async function Page() {
  const [ownerMemberships, resourceCategories] = await Promise.all([
    listResourceOwnerMemberships(),
    listResourceCategories(),
  ])

  if (!ownerMemberships.length) {
    return (
      <EmptyState
        icon={Building2}
        title="No active resource-owner institution"
        description="An active resource-owner membership at an institution is required before you can add a resource."
        action={<Link href="/auth/status" className={buttonVariants({ variant: 'outline' })}>Check membership status</Link>}
      />
    )
  }

  return <ResourceForm ownerMemberships={ownerMemberships} resourceCategories={resourceCategories} />
}
