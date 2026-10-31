'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { createClient } from '@/lib/supabase/client'
import { logSupabaseError } from '@/lib/supabase/dev-error'
import {
  submitMembershipRequestAction,
  type MembershipRequestState,
} from '@/app/auth/status/actions'

interface InstitutionOption {
  id: string
  name: string
}

export function MembershipRequestForm() {
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([])
  const [institutionId, setInstitutionId] = useState('')
  const [requestedRole, setRequestedRole] = useState<'student' | 'resource_owner'>('student')
  const [isLoading, setIsLoading] = useState(true)
  const [loadErrorMessage, setLoadErrorMessage] = useState('')
  const initialState: MembershipRequestState = { status: 'idle', message: '' }
  const [state, formAction, isSubmitting] = useActionState(
    submitMembershipRequestAction,
    initialState,
  )

  useEffect(() => {
    if (state.status === 'success') toast.success(state.message)
  }, [state])

  useEffect(() => {
    let active = true

    async function loadInstitutions() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('institutions')
          .select('id, name')
          .eq('is_active', true)
          .order('name')

        if (error) throw error
        if (active) {
          const options = (data ?? []) as InstitutionOption[]
          setInstitutions(options)
          setInstitutionId((current) => current || options[0]?.id || '')
        }
      } catch (error) {
        logSupabaseError('Loading active institutions failed', {
          message: error instanceof Error ? error.message : 'Unexpected error',
        })
        if (active) {
          setLoadErrorMessage('Active institutions could not be loaded. Please try again later.')
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadInstitutions()
    return () => {
      active = false
    }
  }, [])

  if (isLoading) {
    return <p className="text-ink-muted text-sm">Loading active institutions…</p>
  }

  if (institutions.length === 0) {
    return (
      <p role={loadErrorMessage ? 'alert' : 'status'} className="text-ink-muted text-sm">
        {loadErrorMessage || 'No active institutions are available yet. Contact a ResourceHub administrator.'}
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="membership-institution" className="block text-[13px] font-medium">
        Request membership at
      </label>
      <NativeSelect
        id="membership-institution"
        name="institution_id"
        value={institutionId}
        onChange={(event) => setInstitutionId(event.target.value)}
        disabled={isSubmitting}
      >
        {institutions.map((institution) => (
          <option key={institution.id} value={institution.id}>
            {institution.name}
          </option>
        ))}
      </NativeSelect>
      <label htmlFor="membership-role" className="block text-[13px] font-medium">
        Role you are applying for
      </label>
      <NativeSelect
        id="membership-role"
        name="requested_role"
        value={requestedRole}
        onChange={(event) =>
          setRequestedRole(event.target.value as 'student' | 'resource_owner')
        }
        disabled={isSubmitting}
      >
        <option value="student">Student / Researcher</option>
        <option value="resource_owner">Resource Manager</option>
      </NativeSelect>
      {state.message ? (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-[13px] ${
            state.status === 'error' ? 'text-status-rejected' : 'text-status-approved'
          }`}
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting || !institutionId}>
        {isSubmitting ? 'Submitting…' : 'Request membership'}
      </Button>
    </form>
  )
}
