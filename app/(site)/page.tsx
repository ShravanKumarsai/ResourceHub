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

export default function LandingPage() {
  return (
    <>
      <Hero />
      <CategoryGrid />
      <FeaturedResources />
      <HowItWorks />
      <Governance />
      <ForInstitutions />
      <About />
      <FinalCta />
    </>
  )
}
