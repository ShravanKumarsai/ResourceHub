import { CircleHelp } from 'lucide-react'

export function WorkspaceDemoNotice() {
  return (
    <aside
      role="status"
      className="container-page mx-auto mt-4 mb-6 flex max-w-[1440px] items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950"
    >
      <CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="text-xs leading-5">
        <span className="font-semibold">Database-backed workspace:</span> supported resource, booking,
        handover, incident, activity, and in-app notification actions are stored in Supabase and
        enforced by server-side permissions. Availability and waiting-list controls require their
        pending database migration; email and browser push delivery also require deployment
        configuration.
      </p>
    </aside>
  )
}
