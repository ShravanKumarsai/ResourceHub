import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        <p className="eyebrow mb-2">ResourceHub workspace</p>
        <h1 className="text-2xl font-semibold text-balance sm:text-[30px] sm:leading-10">{title}</h1>
        {description ? (
          <p className="text-ink-muted mt-2 text-[15px] leading-6 text-pretty">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('surface-panel', className)}>
      {title ? (
        <header className="soft-divider flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description ? <p className="text-ink-muted mt-0.5 text-[13px]">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="border-line bg-canvas flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="bg-teal-soft text-teal flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="text-ink-muted mt-1 max-w-sm text-sm leading-6 text-pretty">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
