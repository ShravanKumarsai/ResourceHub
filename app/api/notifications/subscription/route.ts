import { NextResponse } from 'next/server'
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

async function getAuthenticatedClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  return error || !data.user ? null : { supabase, user: data.user }
}

export async function GET() {
  const authenticated = await getAuthenticatedClient()
  if (!authenticated) {
    return jsonResponse({ error: 'authentication_required' }, 401)
  }

  const readiness = getNotificationDeliveryReadiness()
  return jsonResponse({
    pushAvailable: readiness.pushAvailable,
    vapidPublicKey: readiness.vapidPublicKey,
  })
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'same_origin_required' }, 403)
  }

  const body = await readJsonBody(request, 4096)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return jsonResponse({ error: 'invalid_request' }, 400)
  }

  const subscription = (body as Record<string, unknown>).subscription
  if (typeof subscription !== 'object' || subscription === null || Array.isArray(subscription)) {
    return jsonResponse({ error: 'invalid_subscription' }, 400)
  }

  const fields = subscription as Record<string, unknown>
  const keys =
    typeof fields.keys === 'object' && fields.keys !== null && !Array.isArray(fields.keys)
      ? (fields.keys as Record<string, unknown>)
      : null
  const endpoint = fields.endpoint
  const p256dh = keys?.p256dh
  const auth = keys?.auth

  if (
    typeof endpoint !== 'string' ||
    endpoint.length > 2048 ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string'
  ) {
    return jsonResponse({ error: 'invalid_subscription' }, 400)
  }

  if (!getNotificationDeliveryReadiness().pushAvailable) {
    return jsonResponse({ error: 'push_delivery_not_configured' }, 503)
  }

  const authenticated = await getAuthenticatedClient()
  if (!authenticated) {
    return jsonResponse({ error: 'authentication_required' }, 401)
  }

  const { error } = await authenticated.supabase.rpc(
    'upsert_notification_push_subscription',
    { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth },
  )

  if (error) {
    if (error.code === '54000') {
      return jsonResponse({ error: 'push_subscription_limit_reached' }, 409)
    }
    if (error.code === '22023') {
      return jsonResponse({ error: 'invalid_subscription' }, 400)
    }
    return jsonResponse({ error: 'subscription_unavailable' }, 503)
  }

  return jsonResponse({ saved: true })
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) {
    return jsonResponse({ error: 'same_origin_required' }, 403)
  }

  const body = await readJsonBody(request, 3072)
  const endpoint =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).endpoint
      : null

  if (typeof endpoint !== 'string' || endpoint.length > 2048) {
    return jsonResponse({ error: 'invalid_subscription' }, 400)
  }

  const authenticated = await getAuthenticatedClient()
  if (!authenticated) {
    return jsonResponse({ error: 'authentication_required' }, 401)
  }

  const { error } = await authenticated.supabase.rpc(
    'delete_notification_push_subscription',
    { p_endpoint: endpoint },
  )
  if (error) {
    return jsonResponse({ error: 'subscription_unavailable' }, 503)
  }

  return jsonResponse({ removed: true })
}
