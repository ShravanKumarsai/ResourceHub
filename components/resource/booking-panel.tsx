'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { joinWaitingListRequest, submitBookingRequest } from '@/app/bookings/actions'
import { BookingStatusBadge } from '@/components/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { durationHours, formatDate, formatPrice, getTodayIso, overlaps } from '@/lib/format'
import type { Booking, Resource } from '@/lib/types'

const TIMES = Array.from({ length: 25 }, (_, i) => {
  const mins = 8 * 60 + i * 30
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${h}:${m}`
})

export function PublicBookingCard({ resource }: { resource: Resource }) {
  return (
    <div className="border-line rounded-xl border bg-white p-5">
      <h2 className="text-base font-semibold">Request time on this resource</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Cost</dt>
          <dd className="font-medium">{formatPrice(resource.hourlyRate)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Approval</dt>
          <dd className="font-medium">{resource.approval}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Maximum session</dt>
          <dd className="font-medium">{resource.maxDurationHours} hours</dd>
        </div>
      </dl>
      <Link href="/login" className={`${buttonVariants({ size: 'lg' })} mt-5 w-full`}>
        Log in to request a booking
      </Link>
      <p className="text-ink-muted mt-3 text-center text-[13px]">
        New here?{' '}
        <Link href="/register" className="text-teal font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}

export function BookingPanel({ resource, bookingsHref }: { resource: Resource; bookingsHref: string }) {
  const [date, setDate] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('12:00')
  const [purpose, setPurpose] = useState('')
  const [ack, setAck] = useState(false)
  const [submitted, setSubmitted] = useState<Booking | null>(null)
  const [touched, setTouched] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false)
  const bookingOperationKey = useRef(crypto.randomUUID())
  const waitingListOperationKey = useRef(crypto.randomUUID())

  const today = getTodayIso()
  const duration = durationHours(start, end)

  const sameDay = useMemo(
    () =>
      [] as Booking[],
    [],
  )
  const hardConflict = false
  const softConflict = false

  const errors: string[] = []
  if (!date) errors.push('Choose a date for your session.')
  else if (date < today) errors.push('The date cannot be in the past.')
  if (duration <= 0) errors.push('The end time must be after the start time.')
  else if (duration > resource.maxDurationHours)
    errors.push(`Sessions are limited to ${resource.maxDurationHours} hours for this resource.`)
  if (purpose.trim().length < 15) errors.push('Describe your purpose in at least 15 characters.')
  if (!ack) errors.push('Confirm that you meet the eligibility and training requirements.')

  const unavailable = resource.availability === 'unavailable'
  const cost = Math.max(duration, 0) * resource.hourlyRate

  async function onJoinWaitingList() {
    if (!date || date < today || end <= start || unavailable) {
      toast.error('Choose a valid available date and time range first.')
      return
    }

    setIsJoiningWaitlist(true)
    try {
      const { entryId } = await joinWaitingListRequest({
        resourceId: resource.id,
        startsAt: new Date(`${date}T${start}:00Z`).toISOString(),
        endsAt: new Date(`${date}T${end}:00Z`).toISOString(),
        idempotencyKey: waitingListOperationKey.current,
      })
      toast.success(`Added to waiting list · reference ${entryId.slice(0, 8)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not join the waiting list.')
    } finally {
      setIsJoiningWaitlist(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (errors.length || unavailable) return

    setIsSubmitting(true)
    try {
      const { bookingId } = await submitBookingRequest({
        resourceId: resource.id,
        startsAt: new Date(`${date}T${start}:00Z`).toISOString(),
        endsAt: new Date(`${date}T${end}:00Z`).toISOString(),
        purpose: purpose.trim(),
        idempotencyKey: bookingOperationKey.current,
      })

      const nextStatus: Booking['status'] = resource.approval === 'Automatic confirmation' ? 'approved' : 'pending'
      const nextBooking: Booking = {
        id: bookingId,
        resourceId: resource.id,
        requesterId: 'me',
        requesterName: 'You',
        requesterAffiliation: resource.institution,
        date,
        start,
        end,
        purpose: purpose.trim(),
        status: nextStatus,
        createdAt: new Date().toISOString(),
      }

      setSubmitted(nextBooking)
      toast.success(
        nextStatus === 'approved'
          ? `Booking ${bookingId.slice(0, 8)} confirmed`
          : `Request ${bookingId.slice(0, 8)} sent to ${resource.ownerName}`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit this booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="border-line rounded-xl border bg-white p-5" role="status">
        <div className="bg-status-approved-bg text-status-approved flex size-10 items-center justify-center rounded-full">
          <CheckCircle2 className="size-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold">
          {submitted.status === 'approved' ? 'Booking confirmed' : 'Request submitted'}
        </h2>
        <p className="text-ink-muted mt-1 text-sm leading-6">
          {submitted.status === 'approved'
            ? 'This resource confirms bookings automatically. Your session is reserved.'
            : `${resource.ownerName} will review your request. You will see the decision under My bookings.`}
        </p>
        <dl className="border-line-muted mt-4 space-y-2.5 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Reference</dt>
            <dd className="font-medium">{submitted.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">When</dt>
            <dd className="text-right font-medium">
              {formatDate(submitted.date, { weekday: true })}
              <br />
              {submitted.start} – {submitted.end}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">Status</dt>
            <dd>
              <BookingStatusBadge status={submitted.status} />
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-col gap-2">
          <Link href={bookingsHref} className={buttonVariants({ size: 'lg' })}>
            View my bookings
          </Link>
          <Button variant="outline" size="lg" onClick={() => setSubmitted(null)}>
            Make another request
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="border-line rounded-xl border bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Request a booking</h2>
        <span className="text-ink text-sm font-medium">{formatPrice(resource.hourlyRate)}</span>
      </div>
      <p className="text-ink-muted mt-1 text-[13px]">{resource.approval} · up to {resource.maxDurationHours} hours</p>

      {unavailable ? (
        <div className="bg-status-rejected-bg text-status-rejected mt-4 flex gap-2 rounded-lg p-3 text-[13px] leading-5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This resource is currently unavailable for new requests.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="bk-date" className="mb-1.5 block text-[13px] font-medium">
            Date
          </label>
          <Input id="bk-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} disabled={unavailable} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="bk-start" className="mb-1.5 block text-[13px] font-medium">
              Start
            </label>
            <NativeSelect id="bk-start" value={start} onChange={(e) => setStart(e.target.value)} disabled={unavailable}>
              {TIMES.slice(0, -1).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <label htmlFor="bk-end" className="mb-1.5 block text-[13px] font-medium">
              End
            </label>
            <NativeSelect id="bk-end" value={end} onChange={(e) => setEnd(e.target.value)} disabled={unavailable}>
              {TIMES.slice(1).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div>
          <label htmlFor="bk-purpose" className="mb-1.5 block text-[13px] font-medium">
            Purpose of use
          </label>
          <Textarea
            id="bk-purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Describe your project and what you will do in this session."
            disabled={unavailable}
          />
        </div>
        <div className="flex items-start gap-2.5">
          <input
            id="bk-ack"
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            disabled={unavailable}
            className="accent-navy mt-0.5 size-4 shrink-0"
          />
          <label htmlFor="bk-ack" className="text-[13px] leading-5">
            I meet the eligibility and training requirements and will follow the safety rules.
          </label>
        </div>
      </div>

      {hardConflict ? (
        <div role="alert" className="bg-status-rejected-bg text-status-rejected mt-4 flex gap-2 rounded-lg p-3 text-[13px] leading-5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This time conflicts with a confirmed reservation. Choose a different slot.
        </div>
      ) : null}
      {softConflict ? (
        <div role="status" className="bg-status-pending-bg text-status-pending mt-4 flex gap-2 rounded-lg p-3 text-[13px] leading-5">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Another request is pending for this time. The owner will resolve the overlap.
        </div>
      ) : null}

      {touched && errors.length ? (
        <ul role="alert" className="text-status-rejected mt-4 list-disc space-y-1 pl-5 text-[13px]">
          {errors.map((er) => (
            <li key={er}>{er}</li>
          ))}
        </ul>
      ) : null}

      <div className="border-line-muted mt-5 flex items-center justify-between border-t pt-4 text-sm">
        <span className="text-ink-muted">Estimated cost</span>
        <span className="font-semibold">{cost === 0 ? 'No charge' : `£${cost.toFixed(2)}`}</span>
      </div>

      {hardConflict ? (
        <Button type="button" variant="outline" size="lg" className="mt-3 w-full" disabled={unavailable || !date || end <= start || isJoiningWaitlist} onClick={onJoinWaitingList}>
          {isJoiningWaitlist ? 'Adding to waiting list…' : 'Join waiting list'}
        </Button>
      ) : null}
      <Button type="submit" size="lg" className="mt-4 w-full" disabled={unavailable || isSubmitting}>
        {isSubmitting
          ? 'Submitting…'
          : resource.approval === 'Automatic confirmation'
            ? 'Confirm booking'
            : 'Submit request'}
      </Button>
    </form>
  )
}
