'use client'

import { useState } from 'react'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, PageHeader, SectionCard } from '@/components/page-header'
import { IncidentStatusBadge, SeverityBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { INCIDENT_STATUS_LABEL, SEVERITY_LABEL, formatDateTime } from '@/lib/format'
import { useStore } from '@/lib/store'
import type { Incident, IncidentSeverity, IncidentStatus, Role } from '@/lib/types'

function ReportDialog({
  role,
  open,
  onOpenChange,
}: {
  role: Role
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { resources, bookings, userFor, reportIncident } = useStore()
  const user = userFor(role)
  const options =
    role === 'owner'
      ? resources.filter((r) => r.ownerId === user.id)
      : resources.filter((r) => bookings.some((b) => b.requesterId === user.id && b.resourceId === r.id))
  const [resourceId, setResourceId] = useState(options[0]?.id ?? '')
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!resourceId || !title.trim() || !description.trim()) {
      setError('Choose a resource and add a title and description.')
      return
    }
    const incident = reportIncident(role, { resourceId, severity, title: title.trim(), description: description.trim() })
    toast.success('Incident reported', { description: `${incident.id} has been sent to the resource owner.` })
    setTitle('')
    setDescription('')
    setError('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Report an incident</DialogTitle>
            <DialogDescription>Describe damage, faults, or safety concerns so the owner can respond.</DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="inc-resource" className="mb-1.5 block text-sm font-medium">
              Resource
            </label>
            <NativeSelect id="inc-resource" value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <label htmlFor="inc-severity" className="mb-1.5 block text-sm font-medium">
              Severity
            </label>
            <NativeSelect
              id="inc-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
            >
              {(Object.keys(SEVERITY_LABEL) as IncidentSeverity[]).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <label htmlFor="inc-title" className="mb-1.5 block text-sm font-medium">
              Title
            </label>
            <Input id="inc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="inc-desc" className="mb-1.5 block text-sm font-medium">
              Description
            </label>
            <Textarea id="inc-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error ? (
            <p role="alert" className="text-status-rejected text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit report</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function IncidentCard({ incident, role }: { incident: Incident; role: Role }) {
  const { getResource, updateIncident, userFor } = useStore()
  const user = userFor(role)
  const [status, setStatus] = useState<IncidentStatus>(incident.status)
  const [note, setNote] = useState('')

  return (
    <article className="border-line rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <IncidentStatusBadge status={incident.status} />
        <span className="text-ink-muted text-xs">{incident.id}</span>
      </div>
      <h3 className="mt-2 text-base font-semibold">{incident.title}</h3>
      <p className="text-ink-muted mt-0.5 text-[13px]">
        {getResource(incident.resourceId)?.name} · reported by {incident.reportedBy} on{' '}
        {formatDateTime(incident.createdAt)}
      </p>
      <p className="mt-3 text-sm leading-6">{incident.description}</p>

      <ol className="border-line-muted mt-4 space-y-2 border-l pl-4">
        {incident.history.map((h, i) => (
          <li key={i} className="text-[13px]">
            <span className="font-medium">{h.by}</span>
            <span className="text-ink-muted"> · {formatDateTime(h.at)}</span>
            <p className="text-ink-muted">{h.text}</p>
          </li>
        ))}
      </ol>

      {role === 'owner' ? (
        <form
          className="border-line-muted mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            updateIncident(incident.id, status, note, user.name)
            setNote('')
            toast.success('Incident updated', { description: `${incident.id} is now ${INCIDENT_STATUS_LABEL[status].toLowerCase()}.` })
          }}
        >
          <div className="sm:w-44">
            <label htmlFor={`st-${incident.id}`} className="mb-1.5 block text-xs font-medium">
              Status
            </label>
            <NativeSelect
              id={`st-${incident.id}`}
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus)}
            >
              {(Object.keys(INCIDENT_STATUS_LABEL) as IncidentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {INCIDENT_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex-1">
            <label htmlFor={`nt-${incident.id}`} className="mb-1.5 block text-xs font-medium">
              Note
            </label>
            <Input
              id={`nt-${incident.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an update for the record"
            />
          </div>
          <Button type="submit" variant="outline">
            Save update
          </Button>
        </form>
      ) : null}
    </article>
  )
}

export function IncidentsView({ role }: { role: Role }) {
  const { incidents, userFor, getResource } = useStore()
  const user = userFor(role)
  const [filter, setFilter] = useState<'all' | IncidentStatus>('all')
  const [reporting, setReporting] = useState(false)

  const scoped = incidents.filter((i) =>
    role === 'student' ? i.reportedById === user.id : getResource(i.resourceId)?.ownerId === user.id,
  )
  const shown = filter === 'all' ? scoped : scoped.filter((i) => i.status === filter)

  return (
    <div className="space-y-6">
      <PageHeader
        title={role === 'owner' ? 'Incident management' : 'Incident reports'}
        description={
          role === 'owner'
            ? 'Review incidents on your resources, update their status, and keep a record of actions taken.'
            : 'Report damage, faults, or safety concerns and follow what happens next.'
        }
        actions={
          <Button onClick={() => setReporting(true)}>
            <ShieldAlert />
            Report incident
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {(['all', 'open', 'investigating', 'resolved'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? 'bg-navy h-9 rounded-full px-4 text-[13px] font-medium text-white'
                : 'border-line hover:bg-surface h-9 rounded-full border bg-white px-4 text-[13px] font-medium'
            }
          >
            {f === 'all' ? 'All' : INCIDENT_STATUS_LABEL[f]}
            <span className="ml-1.5 opacity-70">
              {f === 'all' ? scoped.length : scoped.filter((i) => i.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="space-y-4">
          {shown.map((i) => (
            <IncidentCard key={i.id} incident={i} role={role} />
          ))}
        </div>
      ) : (
        <SectionCard>
          <EmptyState
            icon={ShieldCheck}
            title="No incidents here"
            description="Nothing matches this filter. Reported incidents appear in this list."
          />
        </SectionCard>
      )}

      {reporting ? <ReportDialog role={role} open onOpenChange={(o) => !o && setReporting(false)} /> : null}
    </div>
  )
}
