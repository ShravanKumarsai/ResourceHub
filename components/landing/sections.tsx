import Link from 'next/link'
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  Search,
  ShieldCheck,
  Siren,
  UserCheck,
  Building2,
  History,
} from 'lucide-react'
import { ResourceCard } from '@/components/resource-card'
import { buttonVariants } from '@/components/ui/button'
import { CATEGORY_BLURB, CATEGORY_ICON } from '@/lib/categories'
import { CALDER, HARLOW, NIT, RESOURCES } from '@/lib/data'
import { CATEGORIES } from '@/lib/types'
import { cn } from '@/lib/utils'

function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-navy mt-2 text-3xl leading-tight font-semibold text-balance">{title}</h2>
      {description ? (
        <p className="text-ink-muted mt-3 text-base leading-7 text-pretty">{description}</p>
      ) : null}
    </div>
  )
}

export function CategoryGrid() {
  return (
    <section className="container-page py-16 lg:py-20" aria-labelledby="categories-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Browse by category"
          title="Equipment and spaces for every stage of a project"
        />
        <Link href="/explore" className={buttonVariants({ variant: 'outline' })}>
          View all resources
          <ArrowRight />
        </Link>
      </div>
      <h2 id="categories-heading" className="sr-only">
        Resource categories
      </h2>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICON[category]
          const count = RESOURCES.filter((r) => r.category === category).length
          return (
            <li key={category}>
              <Link
                href={`/explore?category=${encodeURIComponent(category)}`}
                className="group border-line hover:border-teal/50 flex h-full flex-col rounded-xl border bg-white p-5 transition-colors"
              >
                <span className="bg-teal-soft text-teal flex size-10 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-ink group-hover:text-teal mt-4 text-[15px] leading-5 font-semibold">
                  {category}
                </span>
                <span className="text-ink-muted mt-1.5 text-[13px] leading-5">
                  {CATEGORY_BLURB[category]}
                </span>
                <span className="text-ink-muted mt-4 text-xs">
                  {count === 0 ? 'Opening soon' : `${count} ${count === 1 ? 'resource' : 'resources'}`}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function FeaturedResources() {
  const featured = RESOURCES.filter((r) => ['r-1', 'r-2', 'r-5'].includes(r.id))
  return (
    <section className="bg-canvas border-line border-y py-16 lg:py-20">
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Featured resources"
            title="Well-used equipment, ready to book"
            description="Every listing shows specifications, eligibility, training, and approval rules before you request time."
          />
          <Link href="/explore" className={buttonVariants({ variant: 'outline' })}>
            Explore catalogue
            <ArrowRight />
          </Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((r) => (
            <ResourceCard key={r.id} resource={r} href={`/resources/${r.id}`} />
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    icon: Search,
    title: 'Find a resource',
    body: 'Search by category, institution, or availability and compare specifications side by side.',
  },
  {
    icon: CalendarCheck,
    title: 'Request a time slot',
    body: 'Choose a date and time, explain your purpose, and see conflicts before you submit.',
  },
  {
    icon: UserCheck,
    title: 'Owner reviews',
    body: 'Laboratory managers approve or decline with a note, keeping access accountable.',
  },
  {
    icon: ClipboardCheck,
    title: 'Check out and return',
    body: 'Inspect, record condition, and confirm handover so every loan has a clear record.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container-page scroll-mt-20 py-16 lg:py-20">
      <SectionHeading
        eyebrow="How it works"
        title="From request to return in four accountable steps"
      />
      <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="border-line relative rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="bg-navy flex size-10 items-center justify-center rounded-lg text-white">
                <step.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-ink-muted/60 text-sm font-semibold tabular-nums">0{i + 1}</span>
            </div>
            <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
            <p className="text-ink-muted mt-1.5 text-sm leading-6">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

const GOVERNANCE = [
  {
    icon: ShieldCheck,
    title: 'Eligibility and training enforced',
    body: 'Each resource states who can book and which inductions are required before approval.',
  },
  {
    icon: History,
    title: 'Complete audit trail',
    body: 'Requests, decisions, check-outs, and returns are logged with names and timestamps.',
  },
  {
    icon: Siren,
    title: 'Incident and safety reporting',
    body: 'Faults and near misses are reported against the booking and tracked to resolution.',
  },
]

export function Governance() {
  return (
    <section className="bg-navy text-white">
      <div className="container-page grid gap-10 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-[#7CCAD3] uppercase">
            Safety and governance
          </p>
          <h2 className="mt-2 text-3xl leading-tight font-semibold text-balance text-white">
            Built for institutions that need to know who used what, and in what condition.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-white/75">
            ResourceHub gives laboratory managers the controls they already rely on, without the
            email threads and spreadsheets.
          </p>
        </div>
        <ul className="grid gap-4">
          {GOVERNANCE.map((g) => (
            <li
              key={g.title}
              className="flex gap-4 rounded-xl border border-white/15 bg-white/5 p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <g.icon className="size-5 text-[#7CCAD3]" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">{g.title}</h3>
                <p className="mt-1 text-sm leading-6 text-white/75">{g.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function ForInstitutions() {
  return (
    <section id="institutions" className="container-page scroll-mt-20 py-16 lg:py-20">
      <div className="border-line grid gap-8 rounded-2xl border bg-white p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="eyebrow">For institutions and resource owners</p>
          <h2 className="text-navy mt-2 text-3xl leading-tight font-semibold text-balance">
            List equipment once. Share it responsibly.
          </h2>
          <p className="text-ink-muted mt-3 max-w-xl text-base leading-7">
            Publish specifications, set approval rules and training requirements, and review
            requests from a single queue. See utilisation, returns, and incidents at a glance.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className={buttonVariants({ size: 'lg' })}>
              Register as an owner
            </Link>
            <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Log in to manage resources
            </Link>
          </div>
        </div>
        <ul className="bg-canvas border-line-muted divide-line-muted divide-y rounded-xl border">
          {[
            'Approval workflows with conflict detection',
            'Utilisation and booking analytics',
            'Condition records at check-out and check-in',
            'Incident queue with severity tracking',
          ].map((t) => (
            <li key={t} className="flex items-center gap-3 px-4 py-3.5 text-sm">
              <ClipboardCheck className="text-teal size-4 shrink-0" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function About() {
  return (
    <section id="about" className="bg-canvas border-line scroll-mt-20 border-t py-16 lg:py-20">
      <div className="container-page grid gap-10 lg:grid-cols-2">
        <SectionHeading
          eyebrow="About ResourceHub"
          title="Specialist equipment should not sit idle behind one department."
          description="ResourceHub is a shared access platform for engineering institutions. It helps capital equipment reach more learners and researchers while keeping owners in control of safety, scheduling, and care."
        />
        <div>
          <h3 className="text-ink flex items-center gap-2 text-sm font-semibold">
            <Building2 className="text-teal size-4" aria-hidden="true" />
            Participating institutions
          </h3>
          <ul className="border-line mt-4 divide-y divide-line-muted rounded-xl border bg-white">
            {[
              { name: NIT, note: 'Robotics, electronics, makerspace' },
              { name: HARLOW, note: 'Fabrication, structures and materials' },
              { name: CALDER, note: 'Computing, microscopy, characterisation' },
            ].map((i) => (
              <li key={i.name} className="flex flex-col gap-0.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium">{i.name}</span>
                <span className="text-ink-muted text-[13px]">{i.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="container-page py-16 text-center lg:py-20">
      <h2 className="text-navy mx-auto max-w-2xl text-3xl leading-tight font-semibold text-balance">
        Find the resource that gets your project moving.
      </h2>
      <p className="text-ink-muted mx-auto mt-3 max-w-xl text-base leading-7">
        Browse the catalogue without an account, then sign in when you are ready to request time.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/explore" className={buttonVariants({ size: 'xl' })}>
          Explore resources
        </Link>
        <Link href="/register" className={buttonVariants({ variant: 'outline', size: 'xl' })}>
          Create account
        </Link>
      </div>
    </section>
  )
}
