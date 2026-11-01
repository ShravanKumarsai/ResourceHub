import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/notifications/admin-client'
import { getNotificationDeliveryReadiness } from '@/lib/notifications/config'
import { isSameOriginMutation, readJsonBody } from '@/lib/notifications/http'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return jsonResponse({ error: 'authentication_required' }, 401)
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('email_enabled, push_enabled')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (error) {
    return jsonResponse({ error: 'preferences_unavailable' }, 503)
  }

  const readiness = getNotificationDeliveryReadiness()
  return jsonResponse({
    emailEnabled: data?.email_enabled ?? false,
    pushEnabled: data?.push_enabled ?? false,
    emailAvailable: readiness.emailAvailable,
    pushAvailable: readiness.pushAvailable,
  })
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'same_origin_required' }, 403)
  }

  const body = await readJsonBody(request, 1024)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const payload = body as Record<string, unknown>
  const keys = Object.keys(payload)
  if (
    keys.length === 0 ||
    keys.some((key) => key !== 'emailEnabled' && key !== 'pushEnabled') ||
    keys.some((key) => typeof payload[key] !== 'boolean')
  ) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const readiness = getNotificationDeliveryReadiness()
  if (payload.emailEnabled === true && !readiness.emailAvailable) {
    return jsonResponse({ error: 'email_delivery_not_configured' }, 503)
  }
  if (payload.pushEnabled === true && !readiness.pushAvailable) {
    return jsonResponse({ error: 'push_delivery_not_configured' }, 503)
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return jsonResponse({ error: 'authentication_required' }, 401)
  }

  try {
    const admin = createAdminClient()
    if (payload.pushEnabled === true) {
      const { count, error } = await admin
        .from('notification_push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)

      if (error) {
        return jsonResponse({ error: 'push_subscription_unavailable' }, 503)
      }
      if (!count) {
        return jsonResponse({ error: 'push_subscription_required' }, 409)
      }
    }

    const update: {
      user_id: string
      email_enabled?: boolean
      push_enabled?: boolean
      updated_at: string
    } = {
      user_id: authData.user.id,
      updated_at: new Date().toISOString(),
    }
    if (typeof payload.emailEnabled === 'boolean') {
      update.email_enabled = payload.emailEnabled
    }
    if (typeof payload.pushEnabled === 'boolean') {
      update.push_enabled = payload.pushEnabled
    }

    const { error } = await admin
      .from('notification_preferences')
      .upsert(update, { onConflict: 'user_id' })

    if (error) {
      return jsonResponse({ error: 'preferences_unavailable' }, 503)
    }

    for (const [key, channel] of [
      ['emailEnabled', 'email'],
      ['pushEnabled', 'push'],
    ] as const) {
      if (payload[key] === false) {
        await admin
          .from('notification_delivery_jobs')
          .update({
            status: 'skipped',
            locked_until: null,
            last_error: 'preference_disabled',
          })
          .eq('recipient_id', authData.user.id)
          .eq('channel', channel)
          .eq('status', 'pending')
      }
    }

    return jsonResponse({
      emailEnabled: payload.emailEnabled,
      pushEnabled: payload.pushEnabled,
    })
  } catch {
    return jsonResponse({ error: 'notification_delivery_unavailable' }, 503)
  }
}
