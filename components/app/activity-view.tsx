'use client'

import { useState } from 'react'
import {
  ArrowLeftRight,
  CalendarCheck,
  CalendarX,
  CircleDot,
  History,
  PackageCheck,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { EmptyState, PageHeader, SectionCard } from '@/components/page-header'
import { NativeSelect } from '@/components/ui/native-select'
import { formatDateTime } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { ActivityType, Role } from '@/lib/types'

const TYPE_META: Record<ActivityType, { label: string; icon: LucideIcon }> = {
  'booking-requested': { label: 'Booking requests', icon: CalendarCheck },
  'booking-approved': { label: 'Approvals', icon: CircleDot },
  'booking-rejected': { label: 'Declines', icon: CalendarX },
  'booking-cancelled': { label: 'Cancellations', icon: CalendarX },
  'check-out': { label: 'Check-outs', icon: ArrowLeftRight },
  'check-in': { label: 'Check-ins', icon: PackageCheck },
  incident: { label: 'Incidents', icon: ShieldAlert },
  resource: { label: 'Resource changes', icon: History },
}

export function ActivityView({ role }: { role: Role }) {
  const { activity, userFor } = useStore()
  const user = userFor(role)
  const [type, setType] = useState<'all' | ActivityType>('all')

  const scoped = activity
    .filter((a) => (role === 'student' ? a.actorId === user.id : a.ownerId === user.id))
    .filter((a) => type === 'all' || a.type === type)
    .sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity history"
        description={
          role === 'student'
            ? 'A record of your booking requests, handovers, and incident reports.'
            : 'A record of requests, handovers, and incidents across your resources.'
        }
        actions={
          <div className="w-56">
            <label htmlFor="activity-type" className="sr-only">
              Filter by activity type
            </label>
            <NativeSelect id="activity-type" value={type} onChange={(e) => setType(e.target.value as 'all' | ActivityType)}>
              <option value="all">All activity</option>
              {(Object.keys(TYPE_META) as ActivityType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].label}
                </option>
              ))}
            </NativeSelect>
          </div>
        }
      />

      <SectionCard>
        {scoped.length ? (
          <ol className="divide-line-muted divide-y">
            {scoped.map((a) => {
              const Icon = TYPE_META[a.type].icon
              return (
                <li key={a.id} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
                  <span className="bg-teal-soft text-teal mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-6">{a.text}</p>
                    <p className="text-ink-muted text-xs">
                      {TYPE_META[a.type].label} · {formatDateTime(a.at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <EmptyState icon={History} title="No activity yet" description="Actions you take will be recorded here." />
        )}
      </SectionCard>
    </div>
  )
}
