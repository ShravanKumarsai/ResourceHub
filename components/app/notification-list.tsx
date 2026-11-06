'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'

export interface NotificationItem {
  id: string
  title: string
  body: string
  details: Json
  created_at: string
  read_at: string | null
}

type JsonObject = { [key: string]: Json | undefined }

function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: Json | undefined) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : null
}

function stringList(value: Json | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function HandoverNotificationDetails({ details }: { details: Json }) {
  if (!isJsonObject(details)) return null

  const isHandover = details.type === 'handover_summary'
  if (!isHandover && details.type !== 'late_return') return null
  const handoverUrl = stringValue(details.url)
  const lateHandoverUrl = stringValue(details.handoverUrl)
  const historyUrl = stringValue(details.studentHistoryUrl)
  const checkOut = isHandover && isJsonObject(details.checkOut) ? details.checkOut : null
  const checkIn = isHandover && isJsonObject(details.checkIn) ? details.checkIn : null
  const fields: Array<[string, Json | undefined]> = isHandover
    ? [
        ['Student', details.studentName],
        ['Student identifier', details.studentId],
        ['Institution', details.institutionName],
        ['Resource', details.resourceName],
        ['Resource identifier', details.resourceId],
        ['Booking reference', details.bookingId],
        ['Scheduled start', details.scheduledStart],
        ['Scheduled end', details.scheduledEnd],
        ['Checked out', details.checkedOutAt],
        ['Checked in', details.checkedInAt],
        ['Usage duration (seconds)', details.usageDurationSeconds],
        ['Return status', details.returnedOnTime ? 'On time' : 'Late'],
        ['Institution timezone', details.timezone],
      ]
    : [
        ['Student', details.studentName],
        ['Student identifier', details.studentId],
        ['Resource', details.resourceName],
        ['Resource identifier', details.resourceId],
        ['Booking reference', details.bookingId],
        ['Scheduled deadline', details.scheduledDeadline],
        ['Flag generated', details.flaggedAt],
        ['Check-in status', details.checkInStatus],
        ['Previous late flags', details.previousLateFlags],
        ['Attention threshold', details.lateFlagThreshold],
        ['Institution timezone', details.timezone],
      ]

  return (
    <div className="border-line mt-3 rounded-lg border bg-white p-3">
      <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
        {fields.map(([label, value]) => {
          const text = stringValue(value)
          return text ? (
            <div key={label}>
              <dt className="text-ink-muted">{label}</dt>
              <dd className="text-ink break-words font-medium">{text}</dd>
            </div>
          ) : null
        })}
      </dl>
      {checkOut || checkIn ? (
        <div className="mt-3 grid gap-3 border-t border-line-muted pt-3 sm:grid-cols-2">
          {[['Collection', checkOut], ['Return', checkIn]].map(([label, report]) => {
            if (typeof label !== 'string' || !isJsonObject(report as Json | undefined)) return null
            const value = report as JsonObject
            return (
              <section key={label} className="text-xs">
                <h3 className="font-semibold">{label} condition</h3>
                <p className="text-ink-muted mt-1">
                  Condition: {stringValue(value.rating) ?? 'Not recorded'}
                </p>
                <p className="text-ink-muted mt-1">
                  Checklist: {stringList(value.checklist).join(', ') || 'None'}
                </p>
                {stringValue(value.comments) ? (
                  <p className="text-ink-muted mt-1 whitespace-pre-wrap">
                    Comments: {stringValue(value.comments)}
                  </p>
                ) : null}
                {stringList(value.evidence).length ? (
                  <p className="text-ink-muted mt-1">
                    Evidence: {stringList(value.evidence).length} private attachment(s) stored with the handover.
                  </p>
                ) : null}
              </section>
            )
          })}
        </div>
      ) : null}
      {handoverUrl?.startsWith('/owner/') || lateHandoverUrl?.startsWith('/owner/') ? (
        <Link
          href={handoverUrl?.startsWith('/owner/') ? handoverUrl : lateHandoverUrl!}
          className="mt-3 inline-flex text-xs font-medium text-teal underline underline-offset-2"
        >
          View handover history
        </Link>
      ) : null}
      {historyUrl?.startsWith('/owner/') ? (
        <Link
          href={historyUrl}
          className="ml-4 mt-3 inline-flex text-xs font-medium text-teal underline underline-offset-2"
        >
          View student history
        </Link>
      ) : null}
    </div>
  )
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const [notifications, setNotifications] = useState(items)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function markAsRead(id: string) {
    setSavingId(id)
    try {
      const supabase = createClient()
      const readAt = new Date().toISOString()
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: readAt })
        .eq('id', id)
        .is('read_at', null)

      if (error) throw error

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, read_at: readAt } : notification,
        ),
      )
      window.dispatchEvent(new Event('resourcehub:notifications-updated'))
    } catch (error) {
      console.error('Could not mark notification as read.', error)
      toast.error('Could not mark this notification as read. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <ol className="divide-y divide-line-muted">
      {notifications.map((notification) => {
        const unread = notification.read_at === null
        return (
          <li
            key={notification.id}
            className={`flex items-start gap-4 p-4 sm:p-5 ${unread ? 'bg-teal-soft/35' : ''}`}
          >
            <span
              className={`mt-1 size-2 shrink-0 rounded-full ${unread ? 'bg-teal' : 'bg-transparent'}`}
              aria-label={unread ? 'Unread' : 'Read'}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-sm font-semibold text-navy">{notification.title}</h2>
                <time className="text-ink-muted text-xs" dateTime={notification.created_at}>
                  {new Intl.DateTimeFormat('en', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(notification.created_at))}
                </time>
              </div>
              <p className="text-ink-muted mt-1 text-sm leading-6">{notification.body}</p>
              <HandoverNotificationDetails details={notification.details} />
            </div>
            {unread ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingId === notification.id}
                onClick={() => void markAsRead(notification.id)}
              >
                <Check className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{savingId === notification.id ? 'Saving…' : 'Mark read'}</span>
              </Button>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
