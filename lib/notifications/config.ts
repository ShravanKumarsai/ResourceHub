import 'server-only'

export type NotificationDeliveryReadiness = {
  emailAvailable: boolean
  pushAvailable: boolean
  vapidPublicKey: string | null
}

function isCronConfigured() {
  return Boolean(process.env.CRON_SECRET?.trim() && process.env.CRON_SECRET.trim().length >= 32)
}

function canRunDelivery() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      isCronConfigured(),
  )
}

export function getNotificationDeliveryReadiness(): NotificationDeliveryReadiness {
  const canRun = canRunDelivery()
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null

  return {
    emailAvailable: Boolean(
      canRun &&
        process.env.RESEND_API_KEY?.trim() &&
        process.env.NOTIFICATION_FROM_EMAIL?.trim(),
    ),
    pushAvailable: Boolean(
      canRun &&
        vapidPublicKey &&
        process.env.VAPID_PRIVATE_KEY?.trim() &&
        process.env.VAPID_SUBJECT?.trim(),
    ),
    vapidPublicKey:
      canRun &&
      vapidPublicKey &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim()
        ? vapidPublicKey
        : null,
  }
}

export function requireServiceRoleConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceRoleKey) {
    throw new Error('notification_service_role_unconfigured')
  }

  return { url, serviceRoleKey }
}

export function getEmailProviderConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.NOTIFICATION_FROM_EMAIL?.trim()

  return apiKey && from ? { apiKey, from } : null
}

export function getPushProviderConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim()

  return publicKey && privateKey && subject
    ? { publicKey, privateKey, subject }
    : null
}

export function isCronSecretConfigured() {
  return isCronConfigured()
}

export function isNotificationSchedulerConfigured() {
  return canRunDelivery()
}
