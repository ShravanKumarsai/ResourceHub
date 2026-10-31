import type { Metadata } from 'next'
import { HandoverView } from '@/components/app/handover-view'

export const metadata: Metadata = { title: 'Check-in / Check-out' }

export default function Page() {
  return (
    <>
      <HandoverView role="owner" />
    </>
  )
}
