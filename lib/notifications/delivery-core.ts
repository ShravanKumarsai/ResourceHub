export const MAX_NOTIFICATION_BATCH_SIZE = 20
const DELIVERY_CONCURRENCY = 4

export type NotificationDeliveryChannel = 'email' | 'push'
export type NotificationDeliveryOutcome = 'sent' | 'retry' | 'skipped'

export type ClaimedNotificationJob = {
  id: string
  notification_id: string
  recipient_id: string
  channel: NotificationDeliveryChannel
  title: string
  body: string
}

export type DeliveryResult = {
  outcome: NotificationDeliveryOutcome
  errorCode?: string
  providerMessageId?: string
}

export class DeliveryProviderError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'DeliveryProviderError'
    this.code = code
  }
}

export type NotificationDeliveryDependencies = {
  deliver(job: ClaimedNotificationJob): Promise<DeliveryResult>
  finish(job: ClaimedNotificationJob, result: DeliveryResult): Promise<boolean>
}

export type NotificationDeliverySummary = {
  claimed: number
  sent: number
  retrying: number
  skipped: number
  finishErrors: number
}

function getErrorCode(error: unknown) {
  if (error instanceof DeliveryProviderError && /^[a-z0-9_]{1,80}$/.test(error.code)) {
    return error.code
  }

  return 'provider_error'
}

export async function processClaimedNotificationJobs(
  jobs: ClaimedNotificationJob[],
  dependencies: NotificationDeliveryDependencies,
): Promise<NotificationDeliverySummary> {
  const summary: NotificationDeliverySummary = {
    claimed: jobs.length,
    sent: 0,
    retrying: 0,
    skipped: 0,
    finishErrors: 0,
  }
  let nextJob = 0

  async function processNext() {
    while (nextJob < jobs.length) {
      const job = jobs[nextJob]
      nextJob += 1

      let result: DeliveryResult
      try {
        result = await dependencies.deliver(job)
      } catch (error) {
        result = { outcome: 'retry', errorCode: getErrorCode(error) }
      }

      try {
        const finished = await dependencies.finish(job, result)
        if (!finished) {
          summary.finishErrors += 1
          continue
        }

        if (result.outcome === 'sent') summary.sent += 1
        if (result.outcome === 'retry') summary.retrying += 1
        if (result.outcome === 'skipped') summary.skipped += 1
      } catch {
        summary.finishErrors += 1
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(DELIVERY_CONCURRENCY, jobs.length) },
      () => processNext(),
    ),
  )

  return summary
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
