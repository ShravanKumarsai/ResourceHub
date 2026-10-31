import type { Metadata } from 'next'
import { NotificationCenter } from '@/components/app/notification-center'

export const metadata: Metadata = { title: 'Notifications' }

export default function OwnerNotificationsPage() {
  return <NotificationCenter role="owner" />
}
