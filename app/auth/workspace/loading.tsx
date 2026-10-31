export default function WorkspaceAccessLoading() {
  return (
    <div
      className="border-line w-full max-w-2xl animate-pulse rounded-2xl border bg-white p-6 shadow-sm sm:p-8"
      aria-label="Checking workspace access"
    >
      <div className="size-12 rounded-2xl bg-surface" />
      <div className="mt-5 h-8 w-3/4 rounded bg-line-muted" />
      <div className="mt-3 h-4 w-full rounded bg-line-muted" />
      <div className="mt-2 h-4 w-5/6 rounded bg-line-muted" />
      <div className="mt-6 flex gap-3">
        <div className="h-10 w-40 rounded-lg bg-line-muted" />
        <div className="h-10 w-40 rounded-lg bg-line-muted" />
      </div>
    </div>
  )
}
