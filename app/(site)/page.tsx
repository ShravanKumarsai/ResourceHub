import { Suspense } from 'react'
import { Hero } from '@/components/landing/hero'
import {
  About,
  FinalCta,
  ForInstitutions,
  Governance,
  HowItWorks,
  LiveResourceShowcase,
  ResourceShowcaseLoading,
} from '@/components/landing/sections'

export const dynamic = 'force-dynamic'

export default function LandingPage() {
  return (
    <>
      <Suspense
        fallback={
          <div className="container-page py-12 text-sm text-ink-muted" aria-busy="true">
            Loading homepage…
          </div>
        }
      >
        <Hero />
      </Suspense>
      <Suspense fallback={<ResourceShowcaseLoading />}>
        <LiveResourceShowcase />
      </Suspense>
      <HowItWorks />
      <Governance />
      <ForInstitutions />
      <Suspense
        fallback={
          <div className="container-page py-12 text-sm text-ink-muted" aria-busy="true">
            Loading institution directory…
          </div>
        }
      >
        <About />
      </Suspense>
      <FinalCta />
    </>
  )
}
