'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import {
  BellRing,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Mail,
  PencilLine,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { updateProfileAction, type ProfileActionState } from '@/app/profile/actions'
import {
  updateInstitutionReservationLimitAction,
  type MembershipReviewActionState,
} from '@/app/institution/dashboard/actions'
import { Avatar } from '@/components/app/avatar'
import { PageHeader } from '@/components/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getInitials } from '@/lib/identity'

type StatCard = {
  label: string
  value: number | string
  hint: string
}

const INITIAL_STATE: ProfileActionState = { status: 'idle', message: '' }

export function ProfileEditor({
  initialProfile,
  fallbackName,
  roleLabel,
  institutionName,
  roleNames,
  statCards,
  accountRows,
  userEmail,
  otherWorkspace,
  reservationLimit,
}: {
  initialProfile: { display_name: string | null; title: string | null; department: string | null }
  fallbackName: string
  roleLabel: string
  institutionName: string
  roleNames: string[]
  statCards: StatCard[]
  accountRows: Array<[string, string]>
  userEmail: string
  otherWorkspace: { label: string; href: string } | null
  reservationLimit?: number
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [state, formAction, pending] = useActionState(updateProfileAction, INITIAL_STATE)
  const [limitState, limitFormAction, limitPending] = useActionState<MembershipReviewActionState, FormData>(
    updateInstitutionReservationLimitAction,
    { status: 'idle', message: '' },
  )

  useEffect(() => {
    if (state.status === 'success') {
      setIsEditing(false)
      toast.success(state.message)
    } else if (state.status === 'error' && !state.fieldErrors) {
      toast.error(state.message)
    }
  }, [state])

  useEffect(() => {
    if (limitState.status === 'success') {
      toast.success(limitState.message)
    } else if (limitState.status === 'error') {
      toast.error(limitState.message)
    }
  }, [limitState])

  const profile = state.profile ?? initialProfile
  const displayName = profile.display_name?.trim() || fallbackName
  const isVerified = roleNames.length > 0

  const memberSummary = [
    { label: 'Status', value: isVerified ? 'Verified member' : 'Pending review' },
    { label: 'Institution', value: institutionName },
    { label: 'Role', value: roleLabel },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your account details and active institutional membership."
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <section className="surface-panel overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#17324d_0%,#167d8d_100%)] p-5 text-white">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar
                  initials={getInitials(displayName)}
                  className="size-14 border border-white/20 bg-white/10 text-base text-white shadow-inner"
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/75">{roleLabel}</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">{displayName}</h2>
                  <p className="mt-1 text-sm text-white/80">{profile.title || 'Member account'}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="border border-white/20 bg-white/10 text-white hover:bg-white/15"
                onClick={() => setIsEditing((current) => !current)}
              >
                <PencilLine className="size-4" aria-hidden="true" />
                {isEditing ? 'Close' : 'Edit profile'}
              </Button>
            </div>
          </div>

          <div className="p-5">
            <div className="grid gap-3 md:grid-cols-3">
              {statCards.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-line bg-surface/60 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{stat.label}</p>
                  <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-ink">{stat.value}</p>
                  <p className="mt-1 text-[12px] text-ink-muted">{stat.hint}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-ink">Profile information</h3>
                {isEditing ? null : (
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    Update details
                  </Button>
                )}
              </div>

              {isEditing ? (
                <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-surface/40 p-4">
                  <div>
                    <label htmlFor="profile-name" className="mb-1.5 block text-[13px] font-medium text-ink">
                      Full name
                    </label>
                    <Input
                      id="profile-name"
                      name="display_name"
                      defaultValue={profile.display_name ?? ''}
                      maxLength={120}
                      required
                      aria-invalid={Boolean(state.fieldErrors?.display_name)}
                    />
                    {state.fieldErrors?.display_name ? (
                      <p role="alert" className="mt-1.5 text-xs text-destructive">{state.fieldErrors.display_name}</p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="profile-title" className="mb-1.5 block text-[13px] font-medium text-ink">
                      Professional title
                    </label>
                    <Input
                      id="profile-title"
                      name="title"
                      defaultValue={profile.title ?? ''}
                      placeholder="e.g. Research Engineer"
                      maxLength={160}
                      aria-invalid={Boolean(state.fieldErrors?.title)}
                    />
                    {state.fieldErrors?.title ? (
                      <p role="alert" className="mt-1.5 text-xs text-destructive">{state.fieldErrors.title}</p>
                    ) : null}
                  </div>
                  <div>
                    <label htmlFor="profile-department" className="mb-1.5 block text-[13px] font-medium text-ink">
                      Department
                    </label>
                    <Input
                      id="profile-department"
                      name="department"
                      defaultValue={profile.department ?? ''}
                      placeholder="e.g. Mechanical Engineering"
                      maxLength={200}
                      aria-invalid={Boolean(state.fieldErrors?.department)}
                    />
                    {state.fieldErrors?.department ? (
                      <p role="alert" className="mt-1.5 text-xs text-destructive">{state.fieldErrors.department}</p>
                    ) : null}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={pending}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={pending}>
                      {pending ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                </form>
              ) : (
                <dl className="grid gap-3 md:grid-cols-2">
                  {accountRows.map(([label, value]) => {
                    const live =
                      label === 'Full name'
                        ? displayName
                        : label === 'Title'
                          ? profile.title || 'Not set'
                          : label === 'Department'
                            ? profile.department || 'Not set'
                            : value
                    return (
                      <div key={label} className="rounded-2xl border border-line bg-surface/40 p-3.5">
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
                        <dd className="mt-2 text-sm font-medium text-ink">{live}</dd>
                      </div>
                    )
                  })}
                </dl>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="surface-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-ink">Membership & verification</h3>
              {isVerified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-approved-bg px-2.5 py-1 text-[11px] font-semibold text-status-approved">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-pending-bg px-2.5 py-1 text-[11px] font-semibold text-status-pending">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  Pending
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {memberSummary.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2.5">
                  <span className="text-sm text-ink-muted">{item.label}</span>
                  <span className="text-right text-sm font-medium text-ink">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-surface/50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <ShieldCheck className="size-4 text-teal" aria-hidden="true" />
                Access roles
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {roleNames.length ? (
                  roleNames.map((name) => (
                    <span key={name} className="rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-medium text-teal">
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-ink-muted">No active role assigned.</span>
                )}
              </div>
            </div>

            {otherWorkspace ? (
              <Link href={otherWorkspace.href} className={`${buttonVariants({ variant: 'outline' })} mt-4 w-full`}>
                {otherWorkspace.label}
              </Link>
            ) : null}
          </section>

          {reservationLimit !== undefined ? (
            <section className="surface-panel p-5">
              <div>
                <h3 className="text-base font-semibold text-ink">Reservation policy</h3>
                <p className="mt-1 text-sm text-ink-muted">Set the maximum number of active reservations one member can hold.</p>
              </div>
              <form action={limitFormAction} className="mt-4 flex items-end gap-3">
                <div className="flex-1">
                  <label htmlFor="reservation-limit" className="mb-1.5 block text-[13px] font-medium text-ink">Active reservations per member</label>
                  <Input id="reservation-limit" name="max_active_reservations_per_user" type="number" min={1} max={50} step={1} defaultValue={reservationLimit} required aria-describedby="reservation-limit-help" />
                  <p id="reservation-limit-help" className="mt-1.5 text-xs text-ink-muted">Whole numbers from 1 to 50.</p>
                </div>
                <Button type="submit" disabled={limitPending}>{limitPending ? 'Saving…' : 'Save limit'}</Button>
              </form>
            </section>
          ) : null}

          <section className="surface-panel p-5">
            <div className="flex items-center gap-2">
              <BellRing className="size-4 text-teal" aria-hidden="true" />
              <h3 className="text-base font-semibold text-ink">Account settings</h3>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <Mail className="size-4 text-ink-muted" aria-hidden="true" />
                  Email address
                </div>
                <span className="truncate text-xs text-ink-muted">{userEmail}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <Building2 className="size-4 text-ink-muted" aria-hidden="true" />
                  Institution
                </div>
                <span className="truncate text-xs text-ink-muted">{institutionName}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <UserRound className="size-4 text-ink-muted" aria-hidden="true" />
                  Account status
                </div>
                <span className={`text-xs font-medium ${isVerified ? 'text-status-approved' : 'text-status-pending'}`}>
                  {isVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <BriefcaseBusiness className="size-4 text-ink-muted" aria-hidden="true" />
                  Preferences
                </div>
                <span className="text-xs text-ink-muted">Default</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
