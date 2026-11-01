import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/notifications/admin-client'
import {
  getNotificationDeliveryReadiness,
  isCronSecretConfigured,
  isNotificationSchedulerConfigured,
} from '@/lib/notifications/config'
import { isAuthorizedCronRequest } from '@/lib/notifications/cron-auth'
import {
  MAX_NOTIFICATION_BATCH_SIZE,
  processClaimedNotificationJobs,
  type ClaimedNotificationJob,
} from '@/lib/notifications/delivery-core'
import {
  sendNotificationEmail,
  sendNotificationPush,
} from '@/lib/notifications/delivery-providers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function runCron(request: Request) {
  if (!isCronSecretConfigured()) {
    return jsonResponse({ error: 'cron_not_configured' }, 503)
  }
  if (
    !isAuthorizedCronRequest(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
    )
  ) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const readiness = getNotificationDeliveryReadiness()
  const channels: string[] = []
  if (readiness.emailAvailable) channels.push('email')
  if (readiness.pushAvailable) channels.push('push')

  if (!isNotificationSchedulerConfigured()) {
    return jsonResponse({ error: 'notification_scheduler_not_configured' }, 503)
  }

  try {
    const admin = createAdminClient()
    const { data: scheduledCount, error: scheduleError } = await admin.rpc(
      'queue_scheduled_booking_notifications',
    )
    if (scheduleError) {
      return jsonResponse({ error: 'scheduled_notifications_unavailable' }, 503)
    }

    if (channels.length === 0) {
      return jsonResponse({
        claimed: 0,
        sent: 0,
        retrying: 0,
        skipped: 0,
        finishErrors: 0,
        scheduledNotifications: scheduledCount ?? 0,
        deliveryConfigured: false,
      })
    }

    const { data, error } = await admin.rpc('claim_notification_delivery_jobs', {
      p_channels: channels,
      p_limit: MAX_NOTIFICATION_BATCH_SIZE,
    })

    if (error) {
      return jsonResponse({ error: 'delivery_queue_unavailable' }, 503)
    }

    const jobs = (data ?? []) as ClaimedNotificationJob[]
    const summary = await processClaimedNotificationJobs(jobs, {
      deliver(job) {
        return job.channel === 'email'
          ? sendNotificationEmail(admin, job)
          : sendNotificationPush(admin, job)
      },
      async finish(job, result) {
        const { data: finished, error: finishError } = await admin.rpc(
          'finish_notification_delivery_job',
          {
            p_id: job.id,
            p_outcome: result.outcome,
            p_error_code: result.errorCode ?? null,
            p_provider_message_id: result.providerMessageId ?? null,
          },
        )

        if (finishError) {
          throw new Error('delivery_outcome_persist_failed')
        }

        return finished
      },
    })

    return jsonResponse({
      ...summary,
      scheduledNotifications: scheduledCount ?? 0,
      deliveryConfigured: true,
    })
  } catch {
    return jsonResponse({ error: 'notification_delivery_unavailable' }, 503)
  }
}

export async function GET(request: Request) {
  return runCron(request)
}

export async function POST(request: Request) {
  return runCron(request)
}
