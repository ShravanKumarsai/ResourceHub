'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { Check, Clock3, UserRound, X } from 'lucide-react'
import {
  reviewMembershipAction,
  type MembershipReviewActionState,
} from '@/app/institution/dashboard/actions'
import { Button } from '@/components/ui/button'
import { DashboardQueryError } from '@/components/dashboard/dashboard-state'

export interface PendingApplicant {
  membership_id: string
  requested_at: string
  applicant_name: string | null
  applicant_email: string | null
  requested_role: 'student' | 'resource_owner' | null
  status: string
}

function roleLabel(role: string | null) {
  if (role === 'student') return 'Student / Researcher'
  if (role === 'resource_owner') return 'Resource Manager'
  return null
}

const INITIAL_STATE: MembershipReviewActionState = {
  status: 'idle',
  message: '',
}

function ApplicantReviewCard({ applicant }: { applicant: PendingApplicant }) {
  const [state, formAction, isPending] = useActionState(
    reviewMembershipAction,
    INITIAL_STATE,
  )

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(state.message)
    }
  }, [state])

  const requestedDate = new Date(applicant.requested_at).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  })

  return (
    <article className="surface-panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-teal-soft text-teal shadow-sm">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {applicant.applicant_name?.trim() || 'Name not provided'}
            </h3>
            <p className="text-ink-muted mt-1 break-all text-xs">
              {applicant.applicant_email || 'Email unavailable'}
            </p>
            <p className="text-ink-muted mt-1 flex items-center gap-1.5 text-xs">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Requested {requestedDate} UTC
            </p>
            <p className="text-ink-muted mt-2 text-xs leading-5">
              Requested role: {roleLabel(applicant.requested_role) ?? 'Not recorded for this legacy request'}
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-status-pending-bg px-2.5 py-1 text-[11px] font-semibold text-status-pending">
          {applicant.status}
        </span>
      </div>

      <form action={formAction} className="mt-4 rounded-2xl border border-line bg-surface/40 p-4">
        <input type="hidden" name="membership_id" value={applicant.membership_id} />
        {applicant.requested_role ? (
          <p className="text-xs font-medium">
            Approval will assign: {roleLabel(applicant.requested_role)}
          </p>
        ) : (
          <div>
            <label
              htmlFor={`role-${applicant.membership_id}`}
              className="mb-1.5 block text-xs font-medium"
            >
              Role for this legacy request
            </label>
            <select
              id={`role-${applicant.membership_id}`}
              name="assigned_role"
              defaultValue=""
              disabled={isPending}
              className="border-line bg-white focus-visible:ring-teal h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 sm:max-w-xs"
            >
              <option value="" disabled>
                Select a role
              </option>
              <option value="student">Student / Researcher</option>
              <option value="resource_owner">Resource Manager</option>
            </select>
          </div>
        )}

        {state.message ? (
          <p
            role={state.status === 'error' ? 'alert' : 'status'}
            className={`mt-3 text-xs leading-5 ${
              state.status === 'error' ? 'text-status-rejected' : 'text-status-approved'
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="submit"
            name="decision"
            value="approve"
            disabled={isPending}
            size="sm"
          >
            <Check aria-hidden="true" />
            {isPending
              ? 'Saving…'
              : applicant.requested_role
                ? 'Approve with requested role'
                : 'Approve with selected role'}
          </Button>
          <Button
            type="submit"
            name="decision"
            value="reject"
            disabled={isPending}
            variant="outline"
            size="sm"
          >
            <X aria-hidden="true" />
            Reject
          </Button>
        </div>
      </form>
    </article>
  )
}

export function MembershipReviewSection({
  applicants,
  loadError,
}: {
  applicants: PendingApplicant[] | null
  loadError: boolean
}) {
  if (loadError || applicants === null) {
    return (
      <DashboardQueryError
        title="Pending requests could not be loaded"
        description="Applicant details are available only through the institution-scoped review service."
      />
    )
  }

  if (applicants.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-canvas px-5 py-8 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-white text-ink-muted">
          <Check className="size-5" aria-hidden="true" />
        </span>
        <h3 className="mt-3 text-sm font-semibold">No pending requests</h3>
        <p className="text-ink-muted mt-1 text-xs">
          New membership requests for this institution will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-ink-muted text-xs leading-5">
        Requests display the applicant&apos;s requested role. Approval grants only that role; legacy requests without a saved role require an explicit choice.
      </p>
      {applicants.map((applicant) => (
        <ApplicantReviewCard key={applicant.membership_id} applicant={applicant} />
      ))}
    </div>
  )
}
