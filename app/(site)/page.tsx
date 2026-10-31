import { Hero } from '@/components/landing/hero'
import { listActiveInstitutionNames, listListedResources } from '@/lib/resources/queries'
import {
  About,
  CategoryGrid,
  FeaturedResources,
  FinalCta,
  ForInstitutions,
  Governance,
  HowItWorks,
} from '@/components/landing/sections'

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
