import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { href: '/explore', label: 'Explore resources' },
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/register', label: 'Create an account' },
      { href: '/login', label: 'Log in' },
    ],
  },
  {
    title: 'Institutions',
    links: [
      { href: '/#institutions', label: 'List your resources' },
      { href: '/#institutions', label: 'Governance and approvals' },
      { href: '/#institutions', label: 'Safety and incident tracking' },
      { href: '/login', label: 'Workspace login' },
    ],
  },
  {
    title: 'ResourceHub',
    links: [
      { href: '/#about', label: 'About' },
      { href: '/#about', label: 'Participating institutions' },
      { href: '/login', label: 'Support' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-navy-deep text-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <BrandLogo light />
          <p className="mt-4 text-sm leading-6 text-white/70">
            Shared laboratory, workshop, and computing resources for students, researchers, and
            institutions.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-xs font-semibold tracking-[0.08em] text-white/60 uppercase">
              {col.title}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/85 hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ResourceHub. Demonstration platform with illustrative data.</p>
          <p>Institution-grade access control, audit trails, and safety records.</p>
        </div>
      </div>
    </footer>
  )
}
