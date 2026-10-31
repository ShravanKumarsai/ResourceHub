import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(circle_at_top_left,_rgba(22,125,141,0.12),_transparent_30%),linear-gradient(180deg,#f7f3ee_0%,#f2f5f7_100%)]">
      <header className="border-line border-b bg-white/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between">
          <BrandLogo />
          <Link href="/" className="text-ink-muted hover:text-navy flex items-center gap-1.5 text-sm font-medium transition-colors">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-14">{children}</main>
    </div>
  )
}
