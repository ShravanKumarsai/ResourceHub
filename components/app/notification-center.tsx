import { Bell, CheckCheck } from 'lucide-react'
import { NotificationList, type NotificationItem } from '@/components/app/notification-list'
import { NotificationDeliverySettings } from '@/components/app/notification-delivery-settings'
import { requireInstitutionAdmin } from '@/lib/auth/institution-admin'
import { requireWorkspaceRole } from '@/lib/auth/workspace'
import { getNotificationDeliveryReadiness } from '@/lib/notifications/config'
import type { Role } from '@/lib/types'

export async function NotificationCenter({ role }: { role: Role }) {
  const { supabase, user } =
    role === 'institution'
      ? await requireInstitutionAdmin()
      : await requireWorkspaceRole(role === 'student' ? 'student' : 'resource_manager')

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, created_at, read_at')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error

  const { data: preferences } = await supabase
    .from('notification_preferences')
    .select('email_enabled, push_enabled')
    .eq('user_id', user.id)
    .maybeSingle()
  const readiness = getNotificationDeliveryReadiness()

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">OPERATIONS</p>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Bell className="size-7 text-teal" aria-hidden="true" />
          Notifications
        </h1>
        <p className="text-ink-muted mt-2 text-sm leading-6">
          Booking updates and decisions about your institutional access appear here.
        </p>
      </div>
      <NotificationDeliverySettings
        emailEnabled={preferences?.email_enabled ?? false}
        pushEnabled={preferences?.push_enabled ?? false}
        emailAvailable={readiness.emailAvailable}
        pushAvailable={readiness.pushAvailable}
      />
      <section aria-label="Notification messages" className="surface-panel overflow-hidden">
        {(data ?? []).length ? (
          <NotificationList items={(data ?? []) as NotificationItem[]} />
        ) : (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-teal-soft text-teal">
              <CheckCheck className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-semibold">You’re all caught up</h2>
            <p className="text-ink-muted mt-1 text-sm">There are no operational notifications yet.</p>
          </div>
        )}
      </section>
    </div>
  )
}
