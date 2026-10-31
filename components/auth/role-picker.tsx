'use client'

import {
  Building2,
  BriefcaseBusiness,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type LoginWorkspace = 'student' | 'resource_manager' | 'institution_admin'

const OPTIONS: {
  value: LoginWorkspace
  label: string
  hint: string
  icon: LucideIcon
}[] = [
  {
    value: 'student',
    label: 'Student / Researcher',
    hint: 'Access is granted only with an active student membership in an active institution.',
    icon: GraduationCap,
  },
  {
    value: 'resource_manager',
    label: 'Resource Manager',
    hint: 'Access is granted only with an active resource-owner membership in an active institution.',
    icon: BriefcaseBusiness,
  },
  {
    value: 'institution_admin',
    label: 'Institution Administrator',
    hint: 'Access is granted only with an active institution administrator membership.',
    icon: Building2,
  },
]

export function RolePicker({
  value,
  onChange,
}: {
  value: LoginWorkspace | null
  onChange: (workspace: LoginWorkspace) => void
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">Choose a workspace</legend>
      <div className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map(({ value: option, label, hint, icon: Icon }) => {
          const selected = value === option

          return (
            <label
              key={option}
              className={cn(
                'flex min-h-36 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all duration-200',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal has-[:focus-visible]:ring-offset-2',
                selected
                  ? 'border-teal bg-teal-soft shadow-[0_16px_30px_-24px_rgba(22,125,141,0.9)]'
                  : 'border-line bg-white hover:border-ink-muted/50 hover:bg-canvas hover:shadow-[0_12px_24px_-26px_rgba(15,33,51,0.6)]',
              )}
            >
              <input
                type="radio"
                name="workspace"
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-xl',
                  selected ? 'bg-white text-teal' : 'bg-surface text-navy',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">{label}</span>
                <span className="text-ink-muted mt-1.5 block text-xs leading-5">{hint}</span>
                {selected ? (
                  <span className="mt-2 block text-[11px] font-semibold text-teal">
                    Selected workspace
                  </span>
                ) : null}
              </span>
            </label>
          )
        })}
      </div>
      <p className="text-ink-muted mt-3 text-xs leading-5">
        This selection only chooses where to continue. Access is determined by your active database membership.
      </p>
    </fieldset>
  )
}
