'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { loadManagedHandoverHistory, type HandoverHistoryFilters, type ManagerHandover } from '@/app/bookings/handover-history'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Input } from '@/components/ui/input'

const INITIAL_FILTERS: HandoverHistoryFilters = {
  resourceId: '',
  institutionId: '',
  studentUserId: '',
  bookingId: '',
  fromDate: '',
  toDate: '',
  returnStatus: 'all',
  completion: 'all',
  sort: 'newest',
  page: 0,
}

function formatAt(value: string | null, timezone: string) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function conditionDetails(label: string, value: ManagerHandover['checkOut']) {
  if (!value) return null
  return (
    <section className="rounded-lg bg-canvas p-3">
      <h3 className="text-sm font-semibold">{label} condition</h3>
      <p className="text-ink-muted mt-1 text-xs">Condition: {value.rating.replace(/_/g, ' ')}</p>
      <p className="text-ink-muted mt-1 text-xs">Checklist: {value.checklist.join(', ')}</p>
      {value.notes ? (
        <p className="text-ink-muted mt-2 whitespace-pre-wrap text-xs">
          Comments: {value.notes}
        </p>
      ) : null}
      {value.evidence.length ? (
        <ul className="mt-2 flex flex-wrap gap-3 text-xs">
          {value.evidence.map((evidence) => (
            <li key={evidence.path}>
              <a
                href={evidence.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-teal underline underline-offset-2"
              >
                Open handover evidence
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function HandoverCard({ record }: { record: ManagerHandover }) {
  const attentionRequired = record.lateFlagCount >= record.lateFlagThreshold
  const returnLabel = record.checkedInAt
    ? record.returnedOnTime
      ? 'Returned on time'
      : 'Returned late'
    : record.lateFlagAt
      ? 'Overdue — awaiting check-in'
      : 'Awaiting check-in'

  return (
    <article className="border-line rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{record.institutionName} · {record.resourceName}</p>
          <h2 className="text-navy mt-1 text-base font-semibold">Booking {record.bookingId}</h2>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            record.returnedOnTime === false || record.lateFlagAt
              ? 'bg-status-rejected/10 text-status-rejected'
              : 'bg-surface text-ink-muted'
          }`}
        >
          {returnLabel}
        </span>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-ink-muted">Student</dt>
          <dd className="text-ink mt-0.5 font-medium">{record.studentName}</dd>
          <dd className="text-ink-muted break-all">{record.studentEmail ?? record.studentUserId}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Scheduled booking</dt>
          <dd className="text-ink mt-0.5">
            {formatAt(record.scheduledStart, record.timezone)} – {formatAt(record.scheduledEnd, record.timezone)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Check-in deadline ({record.timezone})</dt>
          <dd className="text-ink mt-0.5">{formatAt(record.deadline, record.timezone)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Actual check-out</dt>
          <dd className="text-ink mt-0.5">{formatAt(record.checkedOutAt, record.timezone)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Actual check-in</dt>
          <dd className="text-ink mt-0.5">{formatAt(record.checkedInAt, record.timezone)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Student late flags in institution</dt>
          <dd className="mt-0.5 flex items-center gap-1.5">
            {attentionRequired ? <AlertTriangle className="size-4 text-status-rejected" aria-hidden="true" /> : null}
            <span className={attentionRequired ? 'font-semibold text-status-rejected' : 'text-ink'}>
              {record.lateFlagCount} / {record.lateFlagThreshold}
              {attentionRequired ? ' — attention marker' : ''}
            </span>
          </dd>
        </div>
        {record.lateFlagAt ? (
          <div>
            <dt className="text-ink-muted">Late flag generated</dt>
            <dd className="text-ink mt-0.5">{formatAt(record.lateFlagAt, record.timezone)}</dd>
          </div>
        ) : null}
      </dl>

      {record.studentComments ? (
        <p className="text-ink-muted mt-3 whitespace-pre-wrap text-sm">
          Student comments: {record.studentComments}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {conditionDetails('Collection', record.checkOut)}
        {conditionDetails('Return', record.checkIn)}
      </div>
    </article>
  )
}

export function ManagerHandoverHistory() {
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [resources, setResources] = useState<
    Array<{ id: string; name: string; institutionId: string; institutionName: string }>
  >([])
  const [handovers, setHandovers] = useState<ManagerHandover[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadPage(nextFilters: HandoverHistoryFilters) {
    setLoading(true)
    setError(null)
    try {
      const result = await loadManagedHandoverHistory(nextFilters)
      setResources(result.resources)
      setHandovers(result.handovers)
      setTotal(result.total)
      setFilters(nextFilters)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Handover history could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initialFilters = {
      ...INITIAL_FILTERS,
      studentUserId: params.get('studentUserId') ?? '',
      bookingId: params.get('bookingId') ?? '',
    }
    void loadPage(initialFilters)
  }, [])

  const institutionIds = [...new Set(resources.map((resource) => resource.institutionId))]
  const filteredResources = resources.filter(
    (resource) => !filters.institutionId || resource.institutionId === filters.institutionId,
  )
  const pageCount = Math.max(1, Math.ceil(total / 25))

  function updateFilter<K extends keyof HandoverHistoryFilters>(
    key: K,
    value: HandoverHistoryFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value, page: 0 }))
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadPage({ ...filters, page: 0 })
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Operations</p>
        <h1 className="text-navy mt-2 text-3xl font-semibold">Handover history</h1>
        <p className="text-ink-muted mt-2 text-sm leading-6">
          Read-only collection and return records for resources you manage.
        </p>
      </header>

      <form className="border-line grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={applyFilters}>
        {institutionIds.length > 1 ? (
          <div>
            <label htmlFor="handover-institution" className="mb-1.5 block text-xs font-medium">Institution</label>
            <NativeSelect
              id="handover-institution"
              value={filters.institutionId}
              onChange={(event) => {
                updateFilter('institutionId', event.target.value)
                updateFilter('resourceId', '')
              }}
            >
              <option value="">All institutions</option>
              {institutionIds.map((id) => (
                <option key={id} value={id}>
                  {resources.find((resource) => resource.institutionId === id)?.institutionName ?? id}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <div>
          <label htmlFor="handover-resource" className="mb-1.5 block text-xs font-medium">Resource</label>
          <NativeSelect
            id="handover-resource"
            value={filters.resourceId}
            onChange={(event) => updateFilter('resourceId', event.target.value)}
          >
            <option value="">All managed resources</option>
            {filteredResources.map((resource) => (
              <option key={resource.id} value={resource.id}>{resource.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="handover-student" className="mb-1.5 block text-xs font-medium">Student / user ID</label>
          <Input
            id="handover-student"
            value={filters.studentUserId}
            onChange={(event) => updateFilter('studentUserId', event.target.value.trim())}
            placeholder="Student UUID"
          />
        </div>
        <div>
          <label htmlFor="handover-booking" className="mb-1.5 block text-xs font-medium">Booking reference</label>
          <Input
            id="handover-booking"
            value={filters.bookingId}
            onChange={(event) => updateFilter('bookingId', event.target.value.trim())}
            placeholder="Booking UUID"
          />
        </div>
        <div>
          <label htmlFor="handover-from" className="mb-1.5 block text-xs font-medium">From date</label>
          <Input id="handover-from" type="date" value={filters.fromDate} onChange={(event) => updateFilter('fromDate', event.target.value)} />
        </div>
        <div>
          <label htmlFor="handover-to" className="mb-1.5 block text-xs font-medium">To date</label>
          <Input id="handover-to" type="date" value={filters.toDate} onChange={(event) => updateFilter('toDate', event.target.value)} />
        </div>
        <div>
          <label htmlFor="handover-timeliness" className="mb-1.5 block text-xs font-medium">Return timing</label>
          <NativeSelect
            id="handover-timeliness"
            value={filters.returnStatus}
            onChange={(event) => updateFilter('returnStatus', event.target.value as HandoverHistoryFilters['returnStatus'])}
          >
            <option value="all">On time and late</option>
            <option value="on_time">On time</option>
            <option value="late">Late</option>
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="handover-completion" className="mb-1.5 block text-xs font-medium">Completion</label>
          <NativeSelect
            id="handover-completion"
            value={filters.completion}
            onChange={(event) => updateFilter('completion', event.target.value as HandoverHistoryFilters['completion'])}
          >
            <option value="all">Completed and outstanding</option>
            <option value="completed">Completed</option>
            <option value="outstanding">Outstanding</option>
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="handover-sort" className="mb-1.5 block text-xs font-medium">Sort</label>
          <NativeSelect
            id="handover-sort"
            value={filters.sort}
            onChange={(event) => updateFilter('sort', event.target.value as HandoverHistoryFilters['sort'])}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="latest_return">Latest return</option>
          </NativeSelect>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={loading}>{loading ? 'Loading…' : 'Apply filters'}</Button>
        </div>
      </form>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <Button className="ml-3" variant="outline" size="sm" onClick={() => void loadPage(filters)}>Retry</Button>
        </div>
      ) : loading ? (
        <p role="status" className="text-ink-muted text-sm">Loading handover history…</p>
      ) : handovers.length ? (
        <>
          <p className="text-ink-muted text-sm">{total} handover record(s)</p>
          <div className="space-y-4">
            {handovers.map((record) => <HandoverCard key={record.id} record={record} />)}
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={loading || filters.page === 0}
              onClick={() => void loadPage({ ...filters, page: filters.page - 1 })}
            >
              <ChevronLeft aria-hidden="true" /> Previous
            </Button>
            <span className="text-ink-muted text-xs">Page {filters.page + 1} of {pageCount}</span>
            <Button
              variant="outline"
              disabled={loading || (filters.page + 1) * 25 >= total}
              onClick={() => void loadPage({ ...filters, page: filters.page + 1 })}
            >
              Next <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </>
      ) : (
        <p className="border-line rounded-xl border bg-white p-6 text-sm text-ink-muted">
          No handover records match these filters.
        </p>
      )}
    </div>
  )
}
