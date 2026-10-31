import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { HeroSearch } from './hero-search'

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Unavailable'
  return new Intl.NumberFormat('en-US').format(value)
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Unavailable'
  return `${Math.round(value)}%`
}

async function getLandingStats() {
  const supabase = await createClient()

  const [institutionsResult, categoriesResult, completedBookingsResult, checkInReportsResult] =
    await Promise.all([
      supabase.from('institutions').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('resources').select('category').eq('listed', true),
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase
        .from('condition_reports')
        .select('rating')
        .eq('phase', 'check_in'),
    ])

  const institutionCount = institutionsResult.error ? null : institutionsResult.count ?? 0
  const listedCategories = categoriesResult.error ? null : categoriesResult.data ?? []
  const categoryCount = listedCategories ? new Set(listedCategories.map((row) => row.category).filter(Boolean)).size : null
  const completedBookingsCount = completedBookingsResult.error ? null : completedBookingsResult.count ?? 0

  let goodReturnRate: number | null = null
  if (!checkInReportsResult.error) {
    const reports = checkInReportsResult.data ?? []
    const total = reports.length
    const goodReturns = reports.filter((report) => ['excellent', 'good'].includes(report.rating)).length
    goodReturnRate = total > 0 ? (goodReturns / total) * 100 : null
  }

  return [
    {
      label: 'Participating institutions',
      value: institutionCount === null ? 'Unavailable' : formatCount(institutionCount),
    },
    {
      label: 'Resource categories',
      value: categoryCount === null ? 'Unavailable' : formatCount(categoryCount),
    },
    {
      label: 'Bookings completed',
      value: completedBookingsCount === null ? 'Unavailable' : formatCount(completedBookingsCount),
    },
    {
      label: 'Resources returned in good condition',
      value: goodReturnRate === null ? 'Unavailable' : formatPercent(goodReturnRate),
    },
  ]
}

export async function Hero() {
  const stats = await getLandingStats()

  return (
    <section className="border-line border-b bg-canvas">
      <div className="container-page grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
        <div>
          <p className="eyebrow">Shared engineering resources</p>
          <h1 className="text-navy mt-3 text-4xl leading-[1.1] font-semibold text-balance sm:text-5xl">
            Book the lab, workshop, or machine your project needs.
          </h1>
          <p className="text-ink-muted mt-5 max-w-xl text-lg leading-8 text-pretty">
            ResourceHub connects students, researchers, and institutions so specialist equipment is
            discoverable, safely booked, and properly returned across participating universities.
          </p>
          <ul className="text-ink mt-6 flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
            {['Owner-approved bookings', 'Condition records on every loan', 'Incident tracking'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="text-teal size-4" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-line relative aspect-[4/3] overflow-hidden rounded-2xl border bg-surface">
          <Image
            src="/images/hero-lab.png"
            alt="Students working at benches in a university engineering workshop"
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
      <div className="container-page pb-12 lg:-mt-6 lg:pb-16">
        <HeroSearch />
        <dl className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="border-line border-l-2 pl-4">
              <dt className="text-ink-muted order-2 text-[13px]">{s.label}</dt>
              <dd className="text-navy text-2xl font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
