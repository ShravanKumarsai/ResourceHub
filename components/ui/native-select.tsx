import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          'border-line text-ink hover:border-ink-muted/40 focus-visible:border-teal focus-visible:ring-teal/25 h-10 w-full appearance-none rounded-lg border bg-white pr-9 pl-3 text-sm transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="text-ink-muted pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>
  )
}

export { NativeSelect }
