'use client'

import { useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { loadIncidentWorkspace, reportIncident, updateIncident } from '@/app/incidents/actions'
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
import type {
  IncidentWorkspaceData,
  IncidentWorkspaceRecord,
} from '@/lib/incident-types'
import type { IncidentSeverity, IncidentStatus } from '@/lib/types'

function ReportDialog({
  role,
  workspace,
  onOpenChange,
  onComplete,
}: {
  role: 'owner' | 'student' | 'institution'
  workspace: IncidentWorkspaceData
  onOpenChange: (open: boolean) => void
  onComplete: () => Promise<void>
}) {
  const [resourceId, setResourceId] = useState(
    role === 'owner'
      ? workspace.resources[0]?.id ?? ''
      : workspace.bookings[0]?.resourceId ?? '',
  )
  const [bookingId, setBookingId] = useState(
    role === 'student' ? workspace.bookings[0]?.id ?? '' : '',
  )
  const [severity, setSeverity] = useState<IncidentSeverity>('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const bookingsForResource = workspace.bookings.filter(
    (booking) => booking.resourceId === resourceId,
  )
  const resourceNames = new Map(
    workspace.resources.map((resource) => [resource.id, resource.name]),
  )

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      const selectedBooking = role === 'student'
        ? workspace.bookings.find((booking) => booking.id === bookingId)
        : bookingsForResource.find((booking) => booking.id === bookingId)
      const result = await reportIncident({
        role,
        resourceId: role === 'student' ? selectedBooking?.resourceId ?? '' : resourceId,
        bookingId: role === 'student' ? bookingId || null : bookingId || null,
        severity,
        title,
        description,
      })
      toast.success('Incident reported', {
        description: `Report ${result.incidentId} was saved.`,
      })
      await onComplete()
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error
        ? submitError.message
        : 'The incident report could not be saved.'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Report an incident</DialogTitle>
            <DialogDescription>
              Describe damage, faults, or safety concerns so the responsible resource manager can respond.
            </DialogDescription>
          </DialogHeader>

          {role === 'student' ? (
            <div>
              <label htmlFor="incident-booking" className="mb-1.5 block text-sm font-medium">
                Your booking
              </label>
              <NativeSelect
                id="incident-booking"
                required
                value={bookingId}
                onChange={(event) => {
                  const nextBookingId = event.target.value
                  setBookingId(nextBookingId)
                  setResourceId(
                    workspace.bookings.find((booking) => booking.id === nextBookingId)?.resourceId ?? '',
                  )
                }}
              >
                <option value="">Choose a booking</option>
                {workspace.bookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {resourceNames.get(booking.resourceId) ?? 'Resource'} ·{' '}
                    {formatDateTime(booking.startsAt)} · {booking.status.replace(/_/g, ' ')}
                  </option>
                ))}
              </NativeSelect>
              {!workspace.bookings.length ? (
                <p className="text-ink-muted mt-1 text-xs">
                  Incident reports require a booking associated with your account.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="incident-resource" className="mb-1.5 block text-sm font-medium">
                  Resource
                </label>
                <NativeSelect
                  id="incident-resource"
                  required
                  value={resourceId}
                  onChange={(event) => {
                    setResourceId(event.target.value)
                    setBookingId('')
                  }}
                >
                  <option value="">Choose a resource</option>
                  {workspace.resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>{resource.name}</option>
                  ))}
                </NativeSelect>
              </div>
              {bookingsForResource.length ? (
                <div>
                  <label htmlFor="incident-booking" className="mb-1.5 block text-sm font-medium">
                    Related booking (optional)
                  </label>
                  <NativeSelect
                    id="incident-booking"
                    value={bookingId}
                    onChange={(event) => setBookingId(event.target.value)}
                  >
                    <option value="">No booking selected</option>
                    {bookingsForResource.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {formatDateTime(booking.startsAt)} · {booking.status.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}
            </>
          )}

          <div>
            <label htmlFor="incident-severity" className="mb-1.5 block text-sm font-medium">
              Severity
            </label>
            <NativeSelect
              id="incident-severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}
            >
              {(Object.keys(SEVERITY_LABEL) as IncidentSeverity[]).map((value) => (
                <option key={value} value={value}>{SEVERITY_LABEL[value]}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <label htmlFor="incident-title" className="mb-1.5 block text-sm font-medium">
              Title
            </label>
            <Input
              id="incident-title"
              minLength={3}
              maxLength={200}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="incident-description" className="mb-1.5 block text-sm font-medium">
              Description
            </label>
            <Textarea
              id="incident-description"
              minLength={10}
              maxLength={10000}
              required
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error ? <p role="alert" className="text-status-rejected text-sm">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !resourceId || (role === 'student' && !bookingId)}>
              {saving ? 'Submitting…' : 'Submit report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function IncidentCard({
  incident,
  resourceName,
  role,
  onUpdated,
}: {
  incident: IncidentWorkspaceRecord
  resourceName: string
  role: 'owner' | 'student'
  onUpdated: () => Promise<void>
}) {
  const [status, setStatus] = useState<IncidentStatus>(incident.status)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submitUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await updateIncident({ incidentId: incident.id, status, note })
      toast.success('Incident updated', {
        description: `${incident.id} is now ${INCIDENT_STATUS_LABEL[status].toLowerCase()}.`,
      })
      setNote('')
      await onUpdated()
    } catch (updateError) {
      const message = updateError instanceof Error
        ? updateError.message
        : 'The incident update could not be saved.'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="border-line rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <IncidentStatusBadge status={incident.status} />
        <span className="text-ink-muted text-xs">{incident.id}</span>
      </div>
      <h3 className="mt-2 text-base font-semibold">{incident.title}</h3>
      <p className="text-ink-muted mt-0.5 text-[13px]">
        {resourceName} · reported by {incident.reportedBy} on {formatDateTime(incident.createdAt)}
      </p>
      {incident.bookingId ? (
        <p className="text-ink-muted mt-1 text-xs">Booking {incident.bookingId}</p>
      ) : null}
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{incident.description}</p>

      <ol className="border-line-muted mt-4 space-y-2 border-l pl-4">
        {incident.history.map((event) => (
          <li key={event.id} className="text-[13px]">
            <span className="font-medium">{event.by}</span>
            <span className="text-ink-muted"> · {formatDateTime(event.at)}</span>
            <p className="text-ink-muted">{event.text}</p>
          </li>
        ))}
      </ol>

      {role === 'owner' ? (
        <form
          className="border-line-muted mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end"
          onSubmit={submitUpdate}
        >
          <div className="sm:w-44">
            <label htmlFor={`incident-status-${incident.id}`} className="mb-1.5 block text-xs font-medium">
              Status
            </label>
            <NativeSelect
              id={`incident-status-${incident.id}`}
              value={status}
              onChange={(event) => setStatus(event.target.value as IncidentStatus)}
            >
              {(Object.keys(INCIDENT_STATUS_LABEL) as IncidentStatus[]).map((value) => (
                <option key={value} value={value}>{INCIDENT_STATUS_LABEL[value]}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex-1">
            <label htmlFor={`incident-note-${incident.id}`} className="mb-1.5 block text-xs font-medium">
              Note
            </label>
            <Input
              id={`incident-note-${incident.id}`}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add an update for the record"
            />
          </div>
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? 'Saving…' : 'Save update'}
          </Button>
          {error ? <p role="alert" className="text-status-rejected text-sm sm:basis-full">{error}</p> : null}
        </form>
      ) : null}
    </article>
  )
}

export function IncidentsView({ role }: { role: 'owner' | 'student' | 'institution' }) {
  const [workspace, setWorkspace] = useState<IncidentWorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paginationError, setPaginationError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState<'all' | IncidentStatus>('all')
  const [reporting, setReporting] = useState(false)

  async function refresh() {
    try {
      setError(null)
      setPaginationError(null)
      const result = await loadIncidentWorkspace(role, null)
      setWorkspace(result)
      setCursor(result.nextCursor)
      setHasMore(result.hasMore)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Incident records could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!cursor || !hasMore || loadingMore) return
    setLoadingMore(true)
    setPaginationError(null)
    try {
      const result = await loadIncidentWorkspace(role, cursor)
      setWorkspace((current) => {
        if (!current) return result
        const existingIds = new Set(current.incidents.map((incident) => incident.id))
        return {
          ...result,
          resources: [
            ...new Map(
              [...current.resources, ...result.resources].map((resource) => [resource.id, resource]),
            ).values(),
          ],
          bookings: [
            ...new Map(
              [...current.bookings, ...result.bookings].map((booking) => [booking.id, booking]),
            ).values(),
          ],
          incidents: [
            ...current.incidents,
            ...result.incidents.filter((incident) => !existingIds.has(incident.id)),
          ],
        }
      })
      setCursor(result.nextCursor)
      setHasMore(result.hasMore)
    } catch (loadError) {
      setPaginationError(
        loadError instanceof Error ? loadError.message : 'More incident records could not be loaded.',
      )
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [role])

  const incidents = workspace?.incidents ?? []
  const shown = filter === 'all'
    ? incidents
    : incidents.filter((incident) => incident.status === filter)
  const resourceNames = new Map(
    (workspace?.resources ?? []).map((resource) => [resource.id, resource.name]),
  )
  const canReport = role === 'student'
    ? Boolean(workspace?.bookings.length)
    : role === 'owner'
      ? Boolean(workspace?.resources.length)
      : false

  return (
    <div className="space-y-6">
      <PageHeader
        title={role === 'owner' ? 'Incident management' : role === 'institution' ? 'Institution incidents' : 'Incident reports'}
        description={
          role === 'owner'
            ? 'Review incidents on your resources, update their status, and keep a persistent record of actions.'
            : role === 'institution'
              ? 'Review incident reports and event history within your institution.'
              : 'Report damage, faults, or safety concerns for your bookings and follow the response.'
        }
        actions={role !== 'institution' ? (
          <Button onClick={() => setReporting(true)} disabled={loading || !canReport}>
            <ShieldAlert />
            Report incident
          </Button>
        ) : undefined}
      />

      {loading ? (
        <p role="status" className="text-ink-muted text-sm">Loading incident records…</p>
      ) : error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <Button variant="outline" onClick={() => { setLoading(true); void refresh() }}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {(['all', 'open', 'investigating', 'resolved'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={
                  filter === value
                    ? 'bg-navy h-9 rounded-full px-4 text-[13px] font-medium text-white'
                    : 'border-line hover:bg-surface h-9 rounded-full border bg-white px-4 text-[13px] font-medium'
                }
              >
                {value === 'all' ? 'All' : INCIDENT_STATUS_LABEL[value]}
                {!hasMore ? (
                  <span className="ml-1.5 opacity-70">
                    {value === 'all' ? incidents.length : incidents.filter((incident) => incident.status === value).length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {shown.length ? (
            <div className="space-y-4">
              {shown.map((incident) => (
                <IncidentCard
                  key={`${incident.id}-${incident.status}`}
                  incident={incident}
                  resourceName={resourceNames.get(incident.resourceId) ?? `Resource (${incident.resourceId.slice(0, 8)})`}
                  role={role === 'owner' ? 'owner' : 'student'}
                  onUpdated={refresh}
                />
              ))}
            </div>
          ) : (
            <SectionCard>
              <EmptyState
                icon={ShieldCheck}
                title={
                  hasMore
                    ? 'No matching incidents on this page'
                    : filter === 'all'
                      ? 'No incidents here'
                      : `No ${INCIDENT_STATUS_LABEL[filter].toLowerCase()} incidents`
                }
                description={
                  hasMore
                    ? 'Load more records to continue searching this status filter.'
                    : incidents.length
                      ? 'No records match this status filter.'
                      : 'Incident reports created for resources in your permitted scope will appear here.'
                }
              />
            </SectionCard>
          )}

          {paginationError ? (
            <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{paginationError}</p>
              <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                Retry loading incidents
              </Button>
            </div>
          ) : null}
          {hasMore ? (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {reporting && workspace && role !== 'institution' ? (
        <ReportDialog
          role={role}
          workspace={workspace}
          onOpenChange={setReporting}
          onComplete={refresh}
        />
      ) : null}
    </div>
  )
}
