import { Hero } from '@/components/landing/hero'
import {
  About,
  CategoryGrid,
  FeaturedResources,
  FinalCta,
  ForInstitutions,
  Governance,
  HowItWorks,
} from '@/components/landing/sections'
import { listActiveInstitutionNames, listListedResources } from '@/lib/resources/queries'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const [resources, institutions] = await Promise.all([
    listListedResources(),
    listActiveInstitutionNames(),
  ])

  return (
    <>
      <Hero />
      <CategoryGrid resources={resources} />
      <FeaturedResources resources={resources} />
      <HowItWorks />
      <Governance />
      <ForInstitutions />
      <About institutions={institutions} />
      <FinalCta />
    </>
  )
}
