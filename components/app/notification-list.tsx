'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export interface NotificationItem {
  id: string
  title: string
  body: string
  created_at: string
  read_at: string | null
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
