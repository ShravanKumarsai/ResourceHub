'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Layers, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, PageHeader } from '@/components/page-header'
import { ResourceImage } from '@/components/resource/resource-image'
import { AvailabilityBadge } from '@/components/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { updateResourceListing } from '@/app/owner/resources/actions'
import { AVAILABILITY_LABEL, formatPrice } from '@/lib/format'
import type { Resource, Availability } from '@/lib/types'

export function OwnerResources({ resources }: { resources: Resource[] }) {
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)

  async function update(resourceId: string, values: { listed?: boolean; availability?: Availability }) {
    setUpdating(resourceId)
    try {
      await updateResourceListing(resourceId, values)
      router.refresh()
      toast.success(values.availability ? 'Availability updated' : values.listed ? 'Resource published' : 'Resource unlisted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update this resource.')
    } finally {
      setUpdating(null)
    }
  }

  async function toggleListing(resource: Resource) {
    if (resource.listed) {
      const confirmed = window.confirm(`Unlist "${resource.name}" from public browsing? This does not remove the resource record or its booking history.`)
      if (!confirmed) return
    }
    await update(resource.id, { listed: !resource.listed })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My resources"
        description="Manage listings, availability, and visibility for the equipment and spaces you oversee."
        actions={
          <Link href="/owner/resources/new" className={buttonVariants()}>
            <Plus />
            Add resource
          </Link>
        }
      />

      {resources.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {resources.map((r) => (
            <article key={r.id} className="surface-panel overflow-hidden p-0">
              <div className="relative aspect-[16/10] overflow-hidden border-b border-line">
                <ResourceImage src={r.image} alt={r.name} sizes="(min-width: 1280px) 50vw, 100vw" />
              </div>

              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold">{r.name}</h2>
                      {!r.listed ? (
                        <span className="inline-flex h-6 items-center rounded-full bg-surface px-2.5 text-[11px] font-medium text-ink-muted">
                          Draft
                        </span>
                      ) : null}
                    </div>
                    <p className="text-ink-muted mt-1 text-[13px]">{r.institution} · {r.category}</p>
                  </div>
                  <AvailabilityBadge availability={r.availability} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                  <span className="rounded-full border border-line bg-surface px-2 py-1">{r.location}</span>
                  <span>{formatPrice(r.hourlyRate)}</span>
                  <span>·</span>
                  <span>{r.approval}</span>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor={`avail-${r.id}`} className="sr-only">Availability for {r.name}</label>
                  <NativeSelect
                    id={`avail-${r.id}`}
                    value={r.availability}
                    disabled={updating === r.id}
                    onChange={(e) => update(r.id, { availability: e.target.value as Availability })}
                    className="sm:flex-1"
                  >
                    {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((a) => (
                      <option key={a} value={a}>
                        {AVAILABILITY_LABEL[a]}
                      </option>
                    ))}
                  </NativeSelect>

                  <div className="flex gap-2 sm:w-[220px]">
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={updating === r.id}
                      onClick={() => void toggleListing(r)}
                    >
                      {r.listed ? 'Unlist' : 'Publish'}
                    </Button>
                    <Link
                      href={`/owner/resources/${r.id}`}
                      className={buttonVariants({ variant: 'outline' })}
                      aria-label={`Edit ${r.name}`}
                    >
                      <Pencil />
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Layers}
          title="No resources yet"
          description="Add your first resource to make it discoverable and bookable."
          action={
            <Link href="/owner/resources/new" className={buttonVariants()}>
              Add resource
            </Link>
          }
        />
      )}
    </div>
  )
}
