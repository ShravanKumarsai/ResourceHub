'use client'

import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  emailEnabled: boolean
  pushEnabled: boolean
  emailAvailable: boolean
  pushAvailable: boolean
}

function decodeVapidKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

async function updatePreference(value: Record<string, boolean>) {
  const response = await fetch('/api/notifications/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null
    throw new Error(result?.error || 'preferences_unavailable')
  }
}

export function NotificationDeliverySettings({
  emailEnabled: initialEmailEnabled,
  pushEnabled: initialPushEnabled,
  emailAvailable,
  pushAvailable,
}: Props) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled)
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled)
  const [saving, setSaving] = useState(false)

  async function toggleEmail(enabled: boolean) {
    setSaving(true)
    try {
      await updatePreference({ emailEnabled: enabled })
      setEmailEnabled(enabled)
    } catch {
      toast.error('Email notification preferences could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications are not supported by this browser.')
      return
    }

    setSaving(true)
    try {
      const configResponse = await fetch('/api/notifications/subscription', {
        cache: 'no-store',
      })
      const config = (await configResponse.json()) as {
        pushAvailable?: boolean
        vapidPublicKey?: string | null
      }

      if (!configResponse.ok || !config.pushAvailable || !config.vapidPublicKey) {
        throw new Error('push_delivery_not_configured')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('notification_permission_denied')
      }

      const registration = await navigator.serviceWorker.register('/service-worker.js')
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(config.vapidPublicKey) as BufferSource,
        }))

      const response = await fetch('/api/notifications/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (!response.ok) {
        throw new Error('subscription_unavailable')
      }

      await updatePreference({ pushEnabled: true })
      setPushEnabled(true)
    } catch {
      toast.error('Push notifications could not be enabled. Check browser permission and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function disablePush() {
    setSaving(true)
    try {
      await updatePreference({ pushEnabled: false })
      setPushEnabled(false)

      const registration = await navigator.serviceWorker.getRegistration('/service-worker.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/notifications/subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
    } catch {
      toast.error('Push notifications were disabled, but this device could not be fully removed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-labelledby="notification-delivery-heading"
      className="surface-panel space-y-4 p-5"
    >
      <div>
        <h2 id="notification-delivery-heading" className="font-semibold text-navy">
          Delivery preferences
        </h2>
        <p className="text-ink-muted mt-1 text-sm">
          In-app notifications remain available regardless of these optional channels.
        </p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={emailEnabled}
          disabled={!emailAvailable || saving}
          onChange={(event) => void toggleEmail(event.target.checked)}
          className="mt-1 accent-teal"
        />
        <span>
          <span className="font-medium">Email notifications</span>
          {!emailAvailable ? (
            <span className="text-ink-muted mt-1 block">
              Email delivery is not configured by this service.
            </span>
          ) : null}
        </span>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          <p className="font-medium">Browser push notifications</p>
          {!pushAvailable ? (
            <p className="text-ink-muted mt-1">
              Push delivery is not configured by this service.
            </p>
          ) : null}
        </div>
        {pushAvailable ? (
          pushEnabled ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void disablePush()}
              className="rounded-md border border-line-muted px-3 py-2 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Disable push'}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void enablePush()}
              className="rounded-md bg-teal px-3 py-2 font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Setting up…' : 'Enable push on this device'}
            </button>
          )
        ) : null}
      </div>
    </section>
  )
}
