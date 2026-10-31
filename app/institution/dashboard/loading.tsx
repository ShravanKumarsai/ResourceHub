export default function InstitutionDashboardLoading() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="flex min-h-dvh">
        <aside className="hidden w-64 shrink-0 animate-pulse bg-navy p-6 lg:block">
          <div className="h-8 w-36 rounded bg-white/15" />
          <div className="mt-12 space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-10 rounded-lg bg-white/10" />
            ))}
          </div>
        </aside>
        <main className="container-page flex-1 py-8 sm:py-10" aria-label="Loading institution dashboard">
          <div className="animate-pulse">
            <div className="h-4 w-36 rounded bg-line" />
            <div className="mt-4 h-10 w-72 rounded bg-line" />
            <div className="mt-3 h-5 max-w-xl rounded bg-line-muted" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-32 rounded-2xl border border-line bg-white" />
              ))}
            </div>
            <div className="mt-8 h-64 rounded-2xl border border-line bg-white" />
          </div>
        </main>
      </div>
    </div>
  )
}
