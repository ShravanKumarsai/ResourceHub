'use client'

import { useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { reportIncidentAction, updateIncidentAction } from '@/app/incidents/actions'
import { EmptyState, PageHeader, SectionCard } from '@/components/page-header'
import { IncidentStatusBadge, SeverityBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime, INCIDENT_STATUS_LABEL, SEVERITY_LABEL } from '@/lib/format'
import type { OperationalIncident } from '@/lib/queries/operational'
import type { Role } from '@/lib/types'

type ResourceOption = { id: string; name: string }

function ReportDialog({ resources, open, onOpenChange }: { resources: ResourceOption[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={async (formData) => { try { await reportIncidentAction(formData); toast.success('Incident reported'); onOpenChange(false) } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not report incident') } }} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Report an incident</DialogTitle>
            <DialogDescription>Describe damage, faults, or safety concerns so the resource owner can respond.</DialogDescription>
          </DialogHeader>
          <div><label htmlFor="inc-resource" className="mb-1.5 block text-sm font-medium">Resource</label><NativeSelect id="inc-resource" name="resource_id" required defaultValue={resources[0]?.id}><option value="">Choose a resource</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</NativeSelect></div>
          <div><label htmlFor="inc-severity" className="mb-1.5 block text-sm font-medium">Severity</label><NativeSelect id="inc-severity" name="severity" defaultValue="medium">{(Object.keys(SEVERITY_LABEL) as Array<keyof typeof SEVERITY_LABEL>).map((severity) => <option key={severity} value={severity}>{SEVERITY_LABEL[severity]}</option>)}</NativeSelect></div>
          <div><label htmlFor="inc-title" className="mb-1.5 block text-sm font-medium">Title</label><Input id="inc-title" name="title" required maxLength={200} /></div>
          <div><label htmlFor="inc-desc" className="mb-1.5 block text-sm font-medium">Description</label><Textarea id="inc-desc" name="description" rows={4} required maxLength={10000} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!resources.length}>Submit report</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function IncidentCard({ incident, role }: { incident: OperationalIncident; role: Role }) {
  const [status, setStatus] = useState(incident.status)
  const [note, setNote] = useState('')
  return <article className="border-line rounded-xl border bg-white p-5 dark:bg-slate-950">
    <div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={incident.severity} /><IncidentStatusBadge status={incident.status} /><span className="text-ink-muted text-xs">{incident.id.slice(0, 8)}</span></div>
    <h3 className="mt-2 text-base font-semibold">{incident.title}</h3>
    <p className="text-ink-muted mt-0.5 text-[13px]">{incident.resourceName} · reported by {incident.reportedBy} on {formatDateTime(incident.createdAt)}</p>
    <p className="mt-3 text-sm leading-6">{incident.description}</p>
    <ol className="border-line-muted mt-4 space-y-2 border-l pl-4">{incident.history.map((event, index) => <li key={`${event.at}-${index}`} className="text-[13px]"><span className="font-medium">{event.by}</span><span className="text-ink-muted"> · {formatDateTime(event.at)}</span><p className="text-ink-muted">{event.text}</p></li>)}</ol>
    {role === 'owner' ? <form action={async (formData) => { try { await updateIncidentAction(formData); toast.success('Incident updated') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update incident') } }} className="border-line-muted mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end"><input type="hidden" name="incident_id" value={incident.id} /><div className="sm:w-44"><label htmlFor={`status-${incident.id}`} className="mb-1.5 block text-xs font-medium">Status</label><NativeSelect id={`status-${incident.id}`} name="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{(Object.keys(INCIDENT_STATUS_LABEL) as Array<keyof typeof INCIDENT_STATUS_LABEL>).map((value) => <option key={value} value={value}>{INCIDENT_STATUS_LABEL[value]}</option>)}</NativeSelect></div><div className="flex-1"><label htmlFor={`note-${incident.id}`} className="mb-1.5 block text-xs font-medium">Note</label><Input id={`note-${incident.id}`} name="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an update for the record" maxLength={2000} /></div><Button type="submit" variant="outline">Save update</Button></form> : null}
  </article>
}

export function IncidentsView({ role, incidents, resources }: { role: Role; incidents: OperationalIncident[]; resources: ResourceOption[] }) {
  const [filter, setFilter] = useState<'all' | OperationalIncident['status']>('all')
  const [reporting, setReporting] = useState(false)
  const shown = filter === 'all' ? incidents : incidents.filter((incident) => incident.status === filter)
  return <div className="space-y-6"><PageHeader title={role === 'owner' ? 'Incident management' : 'Incident reports'} description={role === 'owner' ? 'Review incidents on your resources, update their status, and keep a record of actions taken.' : 'Report damage, faults, or safety concerns and follow what happens next.'} actions={<Button onClick={() => setReporting(true)}><ShieldAlert />Report incident</Button>} /><div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">{(['all', 'open', 'investigating', 'resolved'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={filter === value ? 'bg-navy h-9 rounded-full px-4 text-[13px] font-medium text-white' : 'border-line hover:bg-surface h-9 rounded-full border bg-white px-4 text-[13px] font-medium'}>{value === 'all' ? 'All' : INCIDENT_STATUS_LABEL[value]}<span className="ml-1.5 opacity-70">{value === 'all' ? incidents.length : incidents.filter((incident) => incident.status === value).length}</span></button>)}</div>{shown.length ? <div className="space-y-4">{shown.map((incident) => <IncidentCard key={incident.id} incident={incident} role={role} />)}</div> : <SectionCard><EmptyState icon={ShieldCheck} title="No incidents here" description="Nothing matches this filter. Reported incidents appear in this list." /></SectionCard>}{role === 'student' ? <ReportDialog resources={resources} open={reporting} onOpenChange={setReporting} /> : null}</div>
}
