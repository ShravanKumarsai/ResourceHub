'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { cn } from '@/lib/utils'

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Public site rendering failed.', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <main className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <BrandLogo />
      <div
        role="alert"
        className="border-line mt-10 w-full max-w-xl rounded-2xl border bg-white p-8 shadow-sm"
      >
        <AlertTriangle className="text-status-pending mx-auto size-8" aria-hidden="true" />
        <h1 className="text-navy mt-4 text-2xl font-semibold">
          This page could not be loaded
        </h1>
        <p className="text-ink-muted mt-2 text-sm leading-6">
          The page encountered a temporary problem. Try again, or continue to the resource
          catalogue.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className={cn(buttonVariants({ variant: 'default' }))}
          >
            <RefreshCw />
            Try again
          </button>
          <Link href="/explore" className={buttonVariants({ variant: 'outline' })}>
            Browse resources
          </Link>
        </div>
      </div>
    </main>
  )
}
