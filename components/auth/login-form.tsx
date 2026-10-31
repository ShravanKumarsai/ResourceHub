'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RolePicker, type LoginWorkspace } from '@/components/auth/role-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<LoginWorkspace | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('auth_error')) {
      setError('Email verification could not be completed. Please try signing in again.')
    }
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email address and password.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError('The email or password is incorrect. Please try again.')
        return
      }

      toast.success('You are signed in.')
      router.replace(`/auth/workspace?workspace=${workspace}`)
      router.refresh()
    } catch {
      setError('Could not reach the authentication service. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-4xl overflow-hidden rounded-[28px] border border-line bg-white/90 p-6 shadow-[0_28px_60px_-36px_rgba(15,33,51,0.55)] backdrop-blur-sm sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">WELCOME BACK</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[46px] sm:leading-[1.1]">Log in to ResourceHub</h1>
      </div>
      <p className="text-ink-muted mx-auto mt-4 max-w-2xl text-center text-sm leading-6 sm:text-[15px]">
        Sign in with your ResourceHub account. Your workspace selection does not grant permissions; access is verified against your active database membership.
      </p>

      <div className="mt-8">
        <RolePicker value={workspace} onChange={(selected) => {
          setWorkspace(selected)
          setError('')
        }} />
      </div>

      {workspace ? (
      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5 border-t border-line-muted pt-6">
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-[13px] font-medium">
            Email address
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="block text-[13px] font-medium">
              Password
            </label>
            <span className="text-teal text-[13px]">Forgot password?</span>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-status-rejected bg-status-rejected-bg rounded-lg px-3 py-2 text-[13px]">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Log in'}
        </Button>
      </form>
      ) : (
        <p className="text-ink-muted mt-6 rounded-2xl border border-dashed border-line bg-canvas px-4 py-3 text-center text-sm">
          Select a workspace to continue to sign in.
        </p>
      )}

      <p className="text-ink-muted mt-7 text-center text-sm">
        New to ResourceHub?{' '}
        <Link href="/register" className="text-teal font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
