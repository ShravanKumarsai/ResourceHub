'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function DashboardQueryError({
  title,
  description = 'Your access was verified, but this data could not be loaded.',
}: {
  title: string
  description?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div role="alert" className="rounded-xl border border-status-pending/25 bg-status-pending-bg p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-status-pending">{title}</h3>
          <p className="text-ink-muted mt-1 text-xs leading-5">{description}</p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => router.refresh())}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-navy transition-colors hover:bg-surface disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isPending ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    </div>
  )
}

export function DashboardErrorFallback({ reset }: { reset: () => void }) {
  const [isPending, startTransition] = useTransition()

  return (
    <main className="container-page flex min-h-[50vh] max-w-3xl items-center py-12">
      <section role="alert" className="w-full rounded-2xl border border-status-pending/25 bg-status-pending-bg p-6">
        <h1 className="text-lg font-semibold text-status-pending">Dashboard could not be loaded</h1>
        <p className="text-ink-muted mt-2 text-sm leading-6">
          The dashboard request failed. Your account access was not changed. Retry to load the latest data.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(reset)}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-navy/90 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isPending ? 'Retrying…' : 'Retry dashboard'}
        </button>
      </section>
    </main>
  )
}

export function DashboardLoading({ label = 'dashboard' }: { label?: string }) {
  return (
    <main className="container-page min-h-[60vh] py-8 sm:py-10" aria-label={`Loading ${label}`}>
      <div className="animate-pulse" aria-hidden="true">
        <div className="h-4 w-40 rounded bg-line" />
        <div className="mt-4 h-10 w-72 max-w-full rounded bg-line" />
        <div className="mt-3 h-5 max-w-xl rounded bg-line-muted" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-32 rounded-2xl border border-line bg-white" />
          ))}
        </div>
        <div className="mt-8 h-64 rounded-2xl border border-line bg-white" />
      </div>
    </main>
  )
}
