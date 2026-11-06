import Image from 'next/image'
import { unstable_rethrow } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getOptionalSupabaseConfig } from '@/lib/supabase/config'
import { HeroSearch } from './hero-search'

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function unavailableLandingStats() {
  return {
    stats: [
      { label: 'Institutions Participating', value: 'Unavailable' },
      { label: 'Resources Available', value: 'Unavailable' },
    ],
  }
}

async function getLandingStats() {
  if (!getOptionalSupabaseConfig()) {
    return unavailableLandingStats()
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_public_landing_stats')
    if (error) throw error

    const counts = data?.[0]
    if (!counts) throw new Error('The public landing statistics query returned no result.')

    return {
      stats: [
        {
          label: 'Institutions Participating',
          value: formatCount(counts.institutions_participating),
        },
        {
          label: 'Resources Available',
          value: formatCount(counts.resources_available),
        },
      ],
    }
  } catch (error) {
    unstable_rethrow(error)
    const message =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
        ? error.message
        : 'Unknown homepage statistics error'
    console.error('Could not load homepage statistics.', { message })
    return unavailableLandingStats()
  }
}

export async function Hero() {
  const { stats } = await getLandingStats()

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
        <dl className="mt-8 grid grid-cols-2 gap-6">
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
