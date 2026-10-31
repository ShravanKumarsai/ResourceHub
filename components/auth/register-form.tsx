'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { createClient } from '@/lib/supabase/client'
import { logSupabaseError } from '@/lib/supabase/dev-error'

interface InstitutionOption {
  id: string
  name: string
}

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [requestedRole, setRequestedRole] = useState<'student' | 'resource_owner'>('student')
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([])
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoadingInstitutions, setIsLoadingInstitutions] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    async function loadInstitutions() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('institutions')
          .select('id, name')
          .eq('is_active', true)
          .order('name')

        if (error) throw error
        if (active) {
          const options = (data ?? []) as InstitutionOption[]
          setInstitutions(options)
          setInstitutionId(options[0]?.id ?? '')
        }
      } catch {
        if (active) setFormError('Active institutions could not be loaded. Please try again later.')
      } finally {
        if (active) setIsLoadingInstitutions(false)
      }
    }

    void loadInstitutions()
    return () => {
      active = false
    }
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    setSuccess('')
    const next: Record<string, string> = {}
    if (name.trim().length < 2) next.name = 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid institutional email address.'
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    if (!institutionId) next.institution = 'Choose an active institution.'
    setErrors(next)
    if (Object.keys(next).length) return

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const redirectTo = new URL('/auth/callback', window.location.origin)
      redirectTo.searchParams.set('institution_id', institutionId)
      redirectTo.searchParams.set('requested_role', requestedRole)
      const cleanedName = name.trim().slice(0, 120)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo.toString(),
          data: {
            display_name: cleanedName,
            full_name: cleanedName,
            name: cleanedName,
          },
        },
      })

      if (error) {
        logSupabaseError('Account registration failed', error)
        setFormError(error.message)
        return
      }

      if (data.session && data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            { id: data.user.id, display_name: cleanedName },
            { onConflict: 'id' },
          )

        if (profileError) {
          router.replace('/auth/status?setup_error=profile')
          router.refresh()
          return
        }

        const { error: membershipError } = await supabase
          .from('institution_memberships')
          .insert({
            institution_id: institutionId,
            user_id: data.user.id,
            requested_role: requestedRole,
          })

        if (membershipError && membershipError.code !== '23505') {
          logSupabaseError('Registration membership insert failed', membershipError)
          router.replace('/auth/status?setup_error=membership')
          router.refresh()
          return
        }

        router.replace('/auth/status?setup=requested')
        router.refresh()
        return
      }

      setSuccess('Check your email to confirm your account. Your pending institution request will be created after confirmation.')
      toast.success('Confirmation email sent.')
    } catch (error) {
      logSupabaseError('Registration submission failed', {
        message: error instanceof Error ? error.message : 'Unexpected error',
      })
      setFormError('Could not complete registration. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`reg-${key}-error`} role="alert" className="text-status-rejected mt-1.5 text-[13px]">
        {errors[key]}
      </p>
    ) : null

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-line bg-white/90 p-6 shadow-[0_28px_60px_-36px_rgba(15,33,51,0.55)] backdrop-blur-sm sm:p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="text-ink-muted mt-2 text-sm leading-6 sm:text-[15px]">
        Create an account and request a role at an active institution. An institution administrator must approve your request before workspace access is enabled.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor="reg-name" className="mb-1.5 block text-[13px] font-medium">
            Full name
          </label>
          <Input
            id="reg-name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'reg-name-error' : undefined}
          />
          {fieldError('name')}
        </div>
        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-[13px] font-medium">
            Institutional email
          </label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'reg-email-error' : undefined}
          />
          {fieldError('email')}
        </div>
        <div>
          <label htmlFor="reg-institution" className="mb-1.5 block text-[13px] font-medium">
            Institution
          </label>
          <NativeSelect
            id="reg-institution"
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            disabled={isLoadingInstitutions || institutions.length === 0}
            required
            aria-invalid={!!errors.institution}
            aria-describedby={errors.institution ? 'reg-institution-error' : undefined}
          >
            <option value="">
              {isLoadingInstitutions ? 'Loading institutions…' : 'Choose an institution'}
            </option>
            {institutions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </NativeSelect>
          {fieldError('institution')}
        </div>
        <div>
          <label htmlFor="reg-role" className="mb-1.5 block text-[13px] font-medium">
            Role you are applying for
          </label>
          <NativeSelect
            id="reg-role"
            value={requestedRole}
            onChange={(event) =>
              setRequestedRole(event.target.value as 'student' | 'resource_owner')
            }
            disabled={isSubmitting}
            required
          >
            <option value="student">Student / Researcher</option>
            <option value="resource_owner">Resource Manager</option>
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-[13px] font-medium">
            Password
          </label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'reg-password-error' : undefined}
          />
          {fieldError('password')}
        </div>
        {formError ? (
          <p role="alert" className="text-status-rejected bg-status-rejected-bg rounded-lg px-3 py-2 text-[13px]">
            {formError}
          </p>
        ) : null}
        {success ? (
          <p role="status" className="rounded-lg bg-surface px-3 py-2 text-[13px]">
            {success}
          </p>
        ) : null}
        {institutions.length === 0 && !isLoadingInstitutions ? (
          <p role="status" className="text-ink-muted text-[13px]">
            Registration is unavailable until an administrator provisions an active institution.
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || isLoadingInstitutions || institutions.length === 0}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-ink-muted mt-6 text-center text-sm">
        Already registered?{' '}
        <Link href="/login" className="text-teal font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
