'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  BellRing,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Mail,
  PencilLine,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { Avatar } from '@/components/app/avatar'
import { PageHeader } from '@/components/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/lib/types'

type ProfileDraft = {
  display_name: string
  title: string
  department: string
}

type StatCard = {
  label: string
  value: number | string
  hint: string
}

export function ProfileEditor({
  userId,
  userEmail,
  initialProfile,
  role,
  roleLabel,
  institutionName,
  roleNames,
  statCards,
  accountRows,
  otherRole,
  otherHref,
}: {
  userId: string
  userEmail: string
  initialProfile: { display_name: string | null; title: string | null; department: string | null }
  role: Role
  roleLabel: string
  institutionName: string
  roleNames: string[]
  statCards: StatCard[]
  accountRows: Array<[string, string]>
  otherRole: Role
  otherHref: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<ProfileDraft>({
    display_name: initialProfile.display_name ?? 'Member',
    title: initialProfile.title ?? '',
    department: initialProfile.department ?? '',
  })
  const [profile, setProfile] = useState(initialProfile)
  const [saving, setSaving] = useState(false)

  const displayName = profile.display_name?.trim() || 'Member'
  const initials = displayName.slice(0, 2).toUpperCase()

  const memberSummary = useMemo(
    () => [
      { label: 'Status', value: roleNames.length ? 'Verified member' : 'Pending review', tone: 'success' },
      { label: 'Institution', value: institutionName, tone: 'neutral' },
      { label: 'Role', value: roleLabel, tone: 'neutral' },
    ],
    [institutionName, roleLabel, roleNames.length],
  )

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const nextDisplayName = draft.display_name.trim() || 'Member'
      const nextProfile = {
        display_name: nextDisplayName,
        title: draft.title.trim() || null,
        department: draft.department.trim() || null,
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: nextDisplayName,
          full_name: nextDisplayName,
          name: nextDisplayName,
        },
      })
      if (authError) throw authError

      const { error } = await supabase.from('profiles').update(nextProfile).eq('id', userId)
      if (error) throw error

      setProfile(nextProfile)
      setIsEditing(false)
      toast.success('Profile updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the profile.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraft({
      display_name: profile.display_name ?? 'Member',
      title: profile.title ?? '',
      department: profile.department ?? '',
    })
    setIsEditing(false)
  }

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
                <Avatar initials={initials} className="size-14 border border-white/20 bg-white/10 text-base text-white shadow-inner" />
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
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{stat.value}</p>
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
                <div className="space-y-4 rounded-2xl border border-line bg-surface/40 p-4">
                  <div>
                    <label htmlFor="profile-name" className="mb-1.5 block text-[13px] font-medium text-ink">
                      Full name
                    </label>
                    <Input
                      id="profile-name"
                      value={draft.display_name}
                      onChange={(event) => setDraft((current) => ({ ...current, display_name: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-title" className="mb-1.5 block text-[13px] font-medium text-ink">
                      Professional title
                    </label>
                    <Input
                      id="profile-title"
                      value={draft.title}
                      placeholder="e.g. Research Engineer"
                      onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-department" className="mb-1.5 block text-[13px] font-medium text-ink">
                      Department
                    </label>
                    <Input
                      id="profile-department"
                      value={draft.department}
                      placeholder="e.g. Mechanical Engineering"
                      onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="grid gap-3 md:grid-cols-2">
                  {accountRows.map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-line bg-surface/40 p-3.5">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
                      <dd className="mt-2 text-sm font-medium text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="surface-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-ink">Membership & verification</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-status-approved-bg px-2.5 py-1 text-[11px] font-semibold text-status-approved">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Active
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {memberSummary.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2.5">
                  <span className="text-sm text-ink-muted">{item.label}</span>
                  <span className="text-sm font-medium text-ink">{item.value}</span>
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

            <Link href={otherHref} className={`${buttonVariants({ variant: 'outline' })} mt-4 w-full`}>
              Open {otherRole === 'owner' ? 'resource owner' : 'student'} workspace
            </Link>
          </section>

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
                <span className="text-xs text-ink-muted">{userEmail}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <Building2 className="size-4 text-ink-muted" aria-hidden="true" />
                  Institution
                </div>
                <span className="text-xs text-ink-muted">{institutionName}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <UserRound className="size-4 text-ink-muted" aria-hidden="true" />
                  Account status
                </div>
                <span className="text-xs font-medium text-status-approved">Verified</span>
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
