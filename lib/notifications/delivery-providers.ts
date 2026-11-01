import 'server-only'
import webPush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import {
  getEmailProviderConfig,
  getPushProviderConfig,
} from './config'
import {
  DeliveryProviderError,
  escapeHtml,
  type ClaimedNotificationJob,
  type DeliveryResult,
} from './delivery-core'

type AdminClient = SupabaseClient<Database>

export async function sendNotificationEmail(
  admin: AdminClient,
  job: ClaimedNotificationJob,
): Promise<DeliveryResult> {
  const config = getEmailProviderConfig()
  if (!config) {
    return { outcome: 'skipped', errorCode: 'email_provider_unconfigured' }
  }

  const { data, error } = await admin.auth.admin.getUserById(job.recipient_id)
  if (error) {
    throw new DeliveryProviderError('recipient_lookup_failed')
  }

  if (!data.user?.email) {
    return { outcome: 'skipped', errorCode: 'recipient_email_unavailable' }
  }

  const escapedTitle = escapeHtml(job.title)
  const escapedBody = escapeHtml(job.body)
  let response: Response

  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `resourcehub-notification-${job.id}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [data.user.email],
        subject: job.title,
        text: job.body,
        html: `<h1>${escapedTitle}</h1><p>${escapedBody.replace(/\n/g, '<br>')}</p>`,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new DeliveryProviderError('resend_request_failed')
  }

  if (!response.ok) {
    throw new DeliveryProviderError(`resend_http_${response.status}`)
  }

  let providerMessageId: string | undefined
  try {
    const result = (await response.json()) as { id?: unknown }
    if (typeof result.id === 'string' && result.id.length <= 256) {
      providerMessageId = result.id
    }
  } catch {
    throw new DeliveryProviderError('resend_response_invalid')
  }

  return { outcome: 'sent', providerMessageId }
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendNotificationPush(
  admin: AdminClient,
  job: ClaimedNotificationJob,
): Promise<DeliveryResult> {
  const config = getPushProviderConfig()
  if (!config) {
    return { outcome: 'skipped', errorCode: 'push_provider_unconfigured' }
  }

  const { data: subscriptions, error } = await admin
    .from('notification_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', job.recipient_id)
    .limit(5)

  if (error) {
    throw new DeliveryProviderError('push_subscription_lookup_failed')
  }

  if (!subscriptions?.length) {
    return { outcome: 'skipped', errorCode: 'no_push_subscriptions' }
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey)
  const payload = JSON.stringify({
    id: job.notification_id,
    title: job.title.slice(0, 160),
    body: job.body.slice(0, 1000),
    url: '/',
  })

  let delivered = 0
  let expired = 0
  let failed = false

  await Promise.all(
    (subscriptions as PushSubscriptionRow[]).map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 60, timeout: 10_000 },
        )
        delivered += 1
      } catch (error) {
        const statusCode =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number(error.statusCode)
            : 0

        if (statusCode === 404 || statusCode === 410) {
          expired += 1
          await admin
            .from('notification_push_subscriptions')
            .delete()
            .eq('id', subscription.id)
            .eq('user_id', job.recipient_id)
        } else {
          failed = true
        }
      }
    }),
  )

  if (delivered > 0) {
    return { outcome: 'sent' }
  }
  if (!failed && expired > 0) {
    return { outcome: 'skipped', errorCode: 'push_subscriptions_expired' }
  }

  throw new DeliveryProviderError('push_delivery_failed')
}
