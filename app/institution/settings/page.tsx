import type { Metadata } from 'next'
import { InstitutionAccountabilitySettings } from '@/components/institution/accountability-settings'
import { loadAccountabilitySettings } from './actions'

export const metadata: Metadata = { title: 'Accountability settings' }

export default async function InstitutionSettingsPage() {
  const settings = await loadAccountabilitySettings()
  return <InstitutionAccountabilitySettings initialSettings={settings} />
}
