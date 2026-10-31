'use client'

import { useState } from 'react'
import { ArrowLeftRight, CalendarCheck, CalendarX, CircleDot, History, PackageCheck, ShieldAlert, type LucideIcon } from 'lucide-react'
import { EmptyState, PageHeader, SectionCard } from '@/components/page-header'
import { NativeSelect } from '@/components/ui/native-select'
import { formatDateTime } from '@/lib/format'
import type { OperationalActivity } from '@/lib/queries/operational'
import type { Role } from '@/lib/types'

const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  booking_requested: { label: 'Booking requests', icon: CalendarCheck }, booking_approved: { label: 'Approvals', icon: CircleDot }, booking_rejected: { label: 'Declines', icon: CalendarX }, booking_cancelled: { label: 'Cancellations', icon: CalendarX }, handover: { label: 'Handovers', icon: ArrowLeftRight }, check_out: { label: 'Check-outs', icon: ArrowLeftRight }, check_in: { label: 'Check-ins', icon: PackageCheck }, incident_reported: { label: 'Incidents', icon: ShieldAlert }, incident_updated: { label: 'Incident updates', icon: ShieldAlert }, resource: { label: 'Resource changes', icon: History },
}

export function ActivityView({ role, activity }: { role: Role; activity: OperationalActivity[] }) {
  const [type, setType] = useState('all')
  const types = Array.from(new Set(activity.map((event) => event.type)))
  const shown = type === 'all' ? activity : activity.filter((event) => event.type === type)
  return <div className="space-y-6"><PageHeader title="Activity history" description={role === 'student' ? 'A record of your booking requests, handovers, and incident reports.' : 'A record of requests, handovers, and incidents across your resources.'} actions={<div className="w-56"><label htmlFor="activity-type" className="sr-only">Filter by activity type</label><NativeSelect id="activity-type" value={type} onChange={(event) => setType(event.target.value)}><option value="all">All activity</option>{types.map((eventType) => <option key={eventType} value={eventType}>{TYPE_META[eventType]?.label ?? eventType.replaceAll('_', ' ')}</option>)}</NativeSelect></div>} /><SectionCard>{shown.length ? <ol className="divide-line-muted divide-y">{shown.map((event) => { const Icon = TYPE_META[event.type]?.icon ?? History; return <li key={event.id} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0"><span className="bg-teal-soft text-teal mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"><Icon className="size-4" aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm leading-6">{event.text}</p><p className="text-ink-muted text-xs">{TYPE_META[event.type]?.label ?? event.type} · {formatDateTime(event.at)}</p></div></li>})}</ol> : <EmptyState icon={History} title="No activity yet" description="Actions you take will be recorded here." />}</SectionCard></div>
}
