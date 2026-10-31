import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { AvailabilityBadge } from '@/components/status-badge'
import { ResourceImage } from '@/components/resource/resource-image'
import { formatPrice } from '@/lib/format'
import type { Resource } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ResourceCard({
  resource,
  href,
  className,
}: {
  resource: Resource
  href: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group border-line flex flex-col overflow-hidden rounded-xl border bg-white transition-colors duration-150 hover:border-teal/50 focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className="bg-surface relative aspect-[16/10] overflow-hidden">
        <ResourceImage
          src={resource.image}
          alt={`${resource.name} at ${resource.institution}`}
          sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute top-3 left-3">
          <AvailabilityBadge availability={resource.availability} className="bg-white" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="eyebrow">{resource.category}</p>
          <h3 className="text-ink mt-1 text-[15px] leading-[22px] font-semibold text-pretty group-hover:text-teal">
            {resource.name}
          </h3>
        </div>
        <p className="text-ink-muted flex items-start gap-1.5 text-[13px] leading-5">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {resource.institution}
            <span className="text-ink-muted/80"> · {resource.location}</span>
          </span>
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {resource.highlights.map((h) => (
            <li key={h} className="bg-surface text-navy rounded-md px-2 py-1 text-xs font-medium">
              {h}
            </li>
          ))}
        </ul>
        <div className="border-line-muted mt-auto flex items-center justify-between border-t pt-3 text-[13px]">
          <span className="text-ink font-medium">{formatPrice(resource.hourlyRate)}</span>
          <span className="text-ink-muted">{resource.approval}</span>
        </div>
      </div>
    </Link>
  )
}
