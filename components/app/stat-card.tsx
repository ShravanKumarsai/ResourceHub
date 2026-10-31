import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  href?: string
  tone?: 'default' | 'warning' | 'danger'
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-muted text-[13px] font-medium">{label}</p>
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-md',
            tone === 'default' && 'bg-teal-soft text-teal',
            tone === 'warning' && 'bg-status-pending-bg text-status-pending',
            tone === 'danger' && 'bg-status-rejected-bg text-status-rejected',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-ink-muted mt-1 text-xs">{hint}</p> : null}
    </>
  )
  const cls = 'border-line block rounded-xl border bg-white p-5'
  return href ? (
    <Link href={href} className={cn(cls, 'hover:border-teal/50 transition-colors')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
