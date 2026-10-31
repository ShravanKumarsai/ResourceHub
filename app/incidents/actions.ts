'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspaceRole } from '@/lib/auth/workspace'
import { logSupabaseError } from '@/lib/supabase/dev-error'

export async function reportIncidentAction(formData: FormData) {
  const { supabase } = await requireWorkspaceRole('student')
  const resourceId = String(formData.get('resource_id') ?? '')
  const bookingId = String(formData.get('booking_id') ?? '') || null
  const severity = String(formData.get('severity') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const idempotencyKey = String(formData.get('idempotency_key') ?? '') || crypto.randomUUID()
  const { error } = await supabase.rpc('report_resource_incident', {
    p_resource_id: resourceId,
    p_booking_id: bookingId,
    p_severity: severity,
    p_title: title,
    p_description: description,
    p_idempotency_key: idempotencyKey,
  })
  if (error) {
    logSupabaseError('Reporting incident failed', error)
    throw new Error('The incident could not be reported. Please check your booking and try again.')
  }
  revalidatePath('/student/incidents')
  revalidatePath('/student/activity')
}

export async function updateIncidentAction(formData: FormData) {
  const { supabase } = await requireWorkspaceRole('resource_manager')
  const incidentId = String(formData.get('incident_id') ?? '')
  const status = String(formData.get('status') ?? '')
  const note = String(formData.get('note') ?? '').trim()
  const idempotencyKey = String(formData.get('idempotency_key') ?? '') || crypto.randomUUID()
  const { error } = await supabase.rpc('update_resource_incident', {
    p_incident_id: incidentId,
    p_status: status,
    p_note: note,
    p_idempotency_key: idempotencyKey,
  })
  if (error) {
    logSupabaseError('Updating incident failed', error)
    throw new Error('The incident could not be updated. Please try again.')
  }
  revalidatePath('/owner/incidents')
  revalidatePath('/owner/activity')
}
