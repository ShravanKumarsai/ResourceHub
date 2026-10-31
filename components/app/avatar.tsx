import { cn } from '@/lib/utils'

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-navy flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        className,
      )}
    >
      {initials}
    </span>
  )
}
