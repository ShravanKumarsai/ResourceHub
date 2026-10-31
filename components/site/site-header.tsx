'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { buttonVariants } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/explore', label: 'Explore resources' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#institutions', label: 'For institutions' },
  { href: '/#about', label: 'About' },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="border-line sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <BrandLogo />

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = item.href === pathname
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-navy bg-surface' : 'text-ink-muted hover:text-navy hover:bg-canvas',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
            Log in
          </Link>
          <Link href="/register" className={buttonVariants({ variant: 'default' })}>
            Create account
          </Link>
        </div>

        <Sheet>
          <SheetTrigger
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'lg:hidden')}
            aria-label="Open navigation menu"
          >
            <Menu />
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] gap-0 p-0">
            <SheetHeader className="border-line border-b p-4">
              <SheetTitle className="text-navy">Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile" className="flex flex-col p-3">
              {NAV.map((item) => (
                <SheetClose
                  key={item.href}
                  nativeButton={false}
                  render={
                    <Link
                      href={item.href}
                      className="text-ink hover:bg-canvas rounded-md px-3 py-3 text-[15px] font-medium"
                    />
                  }
                >
                  {item.label}
                </SheetClose>
              ))}
            </nav>
            <div className="border-line mt-2 flex flex-col gap-2 border-t p-4">
              <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                Log in
              </Link>
              <Link href="/register" className={buttonVariants({ size: 'lg' })}>
                Create account
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
