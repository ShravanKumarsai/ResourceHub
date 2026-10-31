import type { Metadata } from 'next'
import { StudentBookings } from '@/components/student/student-bookings'

export const metadata: Metadata = { title: 'My bookings' }

export default function Page() {
  return <StudentBookings />
}
