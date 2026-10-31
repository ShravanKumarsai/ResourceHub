import { CircleHelp } from 'lucide-react'

export function WorkspaceDemoNotice() {
  return (
    <aside
      role="status"
      className="container-page mx-auto mt-4 mb-6 flex max-w-[1440px] items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
    >
      <CircleHelp className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="text-xs leading-5">
        <span className="font-semibold">Demo workspace:</span> your workspace access is verified from
        Supabase, but resource, booking, incident, and activity records are sample data stored only in
        this browser. Actions here do not update shared institution data.
      </p>
    </aside>
  )
}
