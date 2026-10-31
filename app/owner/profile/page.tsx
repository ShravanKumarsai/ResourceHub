import type { Metadata } from 'next'
import { ProfileView } from '@/components/app/profile-view'

export const metadata: Metadata = { title: 'Profile' }

export default function Page() {
  return <ProfileView role="owner" />
}
