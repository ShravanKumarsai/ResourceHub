import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LockKeyhole, ShieldAlert } from 'lucide-react'
import type { LoginWorkspace } from '@/components/auth/role-picker'
import { buttonVariants } from '@/components/ui/button'
import { requireAuthenticatedUser } from '@/lib/auth/server'
import {
  getWorkspaceAccess,
  type WorkspaceAccessStatus,
} from '@/lib/auth/workspace'

export const metadata: Metadata = { title: 'Workspace access' }

const workspaceLabels: Record<LoginWorkspace, string> = {
  student: 'Student / Researcher',
  resource_manager: 'Resource Manager',
  institution_admin: 'Institution Administrator',
}

function isLoginWorkspace(value: string | undefined): value is LoginWorkspace {
  return value === 'student' || value === 'resource_manager' || value === 'institution_admin'
}

export default async function WorkspaceAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; access?: string }>
}) {
  const [{ supabase, user }, params] = await Promise.all([
    requireAuthenticatedUser(),
    searchParams,
  ])
  const workspace = isLoginWorkspace(params.workspace) ? params.workspace : null
  const access: WorkspaceAccessStatus = workspace
    ? await getWorkspaceAccess(supabase, user.id, workspace)
    : 'denied'

  if (workspace && access === 'authorized') {
    redirect(
      workspace === 'institution_admin'
        ? '/institution/dashboard'
        : workspace === 'student'
          ? '/student/dashboard'
          : '/owner/dashboard',
    )
  }

  const waitingForReview = access === 'pending' || access === 'rejected'

  return (
    <div className="border-line w-full max-w-2xl rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
      <span
        className={`flex size-12 items-center justify-center rounded-2xl ${
          waitingForReview
            ? 'bg-status-pending-bg text-status-pending'
            : 'bg-status-rejected-bg text-status-rejected'
        }`}
      >
        {waitingForReview ? (
          <LockKeyhole className="size-5" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-5" aria-hidden="true" />
        )}
      </span>

      <h1 className="mt-5 text-2xl font-semibold">
        {!workspace
          ? 'Choose a workspace to continue'
          : access === 'pending'
            ? `${workspaceLabels[workspace]} access is awaiting approval`
            : access === 'rejected'
              ? `${workspaceLabels[workspace]} request was rejected`
              : 'You do not have access to this workspace'}
      </h1>
      <p className="text-ink-muted mt-2 text-sm leading-6">
        {!workspace
          ? 'Your account is signed in, but the selected workspace could not be verified. Return to login and choose a workspace.'
          : access === 'pending'
            ? 'Your institution membership request is pending. An institution administrator must approve it before you can enter this workspace.'
            : access === 'rejected'
              ? 'Your institution membership request was rejected. Contact an institution administrator if you believe this is incorrect.'
              : `Your account does not have an active ${workspaceLabels[workspace]} role at an active institution. Choosing a workspace never grants access.`}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/auth/status" className={buttonVariants()}>
          View account status
        </Link>
        {access === 'denied' ? (
          <Link href="/register" className={buttonVariants({ variant: 'outline' })}>
            Request membership
          </Link>
        ) : null}
        <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
          Choose another workspace
        </Link>
      </div>
    </div>
  )
}
