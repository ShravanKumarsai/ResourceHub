import type { Metadata } from 'next'
import { NotificationCenter } from '@/components/app/notification-center'

export const metadata: Metadata = { title: 'Notifications' }

export default function StudentNotificationsPage() {
  return <NotificationCenter role="student" />
}
