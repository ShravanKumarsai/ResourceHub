import Link from 'next/link'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-8', className)}
      aria-hidden="true"
      fill="none"
    >
      <rect width="32" height="32" rx="8" fill="#17324D" />
      <circle cx="11" cy="11" r="3" fill="#FFFFFF" />
      <circle cx="21" cy="11" r="3" fill="#7CCAD3" />
      <circle cx="16" cy="22" r="3" fill="#FFFFFF" />
      <path d="M11 11h10M11 11l5 11M21 11l-5 11" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.5" />
    </svg>
  )
}

export function BrandLogo({
  href = '/',
  className,
  light,
}: {
  href?: string
  className?: string
  light?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-2.5 rounded-md', className)}
      aria-label="ResourceHub home"
    >
      <LogoMark />
      <span
        className={cn(
          'text-[17px] font-semibold tracking-tight',
          light ? 'text-white' : 'text-navy',
        )}
      >
        ResourceHub
      </span>
    </Link>
  )
}
