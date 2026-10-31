'use client'

import { useActionState } from 'react'
import { updateInstitutionNameAction, type MembershipReviewActionState } from '@/app/institution/dashboard/actions'

const INITIAL_STATE: MembershipReviewActionState = { status: 'idle', message: '' }

export function InstitutionNameForm({ defaultName, slug }: { defaultName: string; slug: string }) {
  const [state, formAction, pending] = useActionState(updateInstitutionNameAction, INITIAL_STATE)

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <div>
        <label htmlFor="institution-name" className="text-ink-muted mb-2 block text-xs font-medium uppercase tracking-[0.08em]">
          Institution name
        </label>
        <input
          id="institution-name"
          name="name"
          defaultValue={defaultName}
          className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
          maxLength={200}
          required
        />
      </div>

      <div className="rounded-xl border border-line bg-canvas p-3">
        <p className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">Current identity</p>
        <div className="mt-2 grid gap-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Slug</span>
            <span className="font-mono text-ink">{slug}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted">Status</span>
            <span className="inline-flex items-center gap-1.5 font-medium text-status-approved">
              <span className="size-1.5 rounded-full bg-status-approved" />
              Active
            </span>
          </div>
        </div>
      </div>

      {state.status !== 'idle' ? (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-xs font-medium ${state.status === 'error' ? 'text-status-rejected' : 'text-status-approved'}`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save institution name'}
      </button>
    </form>
  )
}
