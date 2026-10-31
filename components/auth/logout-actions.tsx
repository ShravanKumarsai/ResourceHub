'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'

function useLogout() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function signOut() {
    if (isSigningOut) return
    setIsSigningOut(true)

    try {
      const { error } = await createClient().auth.signOut()
      if (error) {
        toast.error('Could not sign out. Please try again.')
        return
      }

      router.replace('/login')
      router.refresh()
    } catch {
      toast.error('Could not sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
    }
  }

  return { isSigningOut, signOut }
}

export function LogoutButton() {
  const { isSigningOut, signOut } = useLogout()

  return (
    <Button type="button" variant="outline" onClick={signOut} disabled={isSigningOut}>
      <LogOut aria-hidden="true" />
      {isSigningOut ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}

export function LogoutMenuItem() {
  const { isSigningOut, signOut } = useLogout()

  return (
    <DropdownMenuItem onClick={signOut} disabled={isSigningOut}>
      <LogOut aria-hidden="true" />
      {isSigningOut ? 'Signing out…' : 'Log out'}
    </DropdownMenuItem>
  )
}
