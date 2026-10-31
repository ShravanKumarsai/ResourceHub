import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Log in' }

export default function InstitutionalLoginPage() {
  redirect('/login')
}
