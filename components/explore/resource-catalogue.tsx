'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react'
import { EmptyState } from '@/components/page-header'
import { ResourceCard } from '@/components/resource-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { AVAILABILITY_LABEL } from '@/lib/format'
import { type Availability, type Resource } from '@/lib/types'

interface Filters {
  q: string
  categories: string[]
  institutions: string[]
  availability: Availability[]
  cost: 'any' | 'free' | 'paid'
}

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function CheckGroup({
  legend,
  options,
  selected,
  onToggle,
  counts,
}: {
  legend: string
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  counts?: Record<string, number>
}) {
  return (
    <fieldset className="border-line-muted border-b py-5 first:pt-0 last:border-0">
      <legend className="text-ink mb-3 text-sm font-semibold">{legend}</legend>
      <div className="space-y-2.5">
        {options.map((o) => {
          const id = `${legend}-${o.value}`.replace(/\s+/g, '-').toLowerCase()
          return (
            <div key={o.value} className="flex items-start gap-2.5">
              <input
                id={id}
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => onToggle(o.value)}
                className="accent-navy mt-0.5 size-4 shrink-0 cursor-pointer rounded"
              />
              <label htmlFor={id} className="text-ink flex-1 cursor-pointer text-[13px] leading-5">
                {o.label}
              </label>
              {counts ? (
                <span className="text-ink-muted text-xs tabular-nums">{counts[o.value] ?? 0}</span>
              ) : null}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

function FilterPanel({
  filters,
  setFilters,
  counts,
  categories,
  institutions,
}: {
  filters: Filters
  setFilters: (f: Filters) => void
  counts: { category: Record<string, number>; institution: Record<string, number> }
  categories: string[]
  institutions: string[]
}) {
  return (
    <div>
      <CheckGroup
        legend="Category"
        options={categories.map((c) => ({ value: c, label: c }))}
        selected={filters.categories}
        onToggle={(v) => setFilters({ ...filters, categories: toggle(filters.categories, v) })}
        counts={counts.category}
      />
      <CheckGroup
        legend="Institution"
        options={institutions.map((i) => ({ value: i, label: i }))}
        selected={filters.institutions}
        onToggle={(v) => setFilters({ ...filters, institutions: toggle(filters.institutions, v) })}
        counts={counts.institution}
      />
      <CheckGroup
        legend="Availability"
        options={(['available', 'limited', 'unavailable'] as Availability[]).map((a) => ({
          value: a,
          label: AVAILABILITY_LABEL[a],
        }))}
        selected={filters.availability}
        onToggle={(v) =>
          setFilters({ ...filters, availability: toggle(filters.availability, v as Availability) })
        }
      />
      <fieldset className="py-5">
        <legend className="text-ink mb-3 text-sm font-semibold">Cost</legend>
        <div className="space-y-2.5">
          {[
            { value: 'any', label: 'Any cost' },
            { value: 'free', label: 'No charge' },
            { value: 'paid', label: 'Charged per hour' },
          ].map((o) => (
            <div key={o.value} className="flex items-center gap-2.5">
              <input
                id={`cost-${o.value}`}
                type="radio"
                name="cost"
                checked={filters.cost === o.value}
                onChange={() => setFilters({ ...filters, cost: o.value as Filters['cost'] })}
                className="accent-navy size-4 cursor-pointer"
              />
              <label htmlFor={`cost-${o.value}`} className="text-ink cursor-pointer text-[13px]">
                {o.label}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

export function ResourceCatalogue({
  basePath,
  resources,
  institutions,
}: {
  basePath: string
  resources: Resource[]
  institutions: string[]
}) {
  const params = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => {
    const category = params.get('category')
    const institution = params.get('institution')
    return {
      q: params.get('q') ?? '',
      categories: category ? [category] : [],
      institutions: institution ? [institution] : [],
      availability: [],
      cost: 'any',
    }
  })
  const [sort, setSort] = useState('relevance')

  const listed = useMemo(() => resources.filter((r) => r.listed), [resources])
  const categoryOptions = useMemo(
    () => [...new Set(listed.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [listed],
  )

  const counts = useMemo(() => {
    const category: Record<string, number> = {}
    const institution: Record<string, number> = {}
    for (const r of listed) {
      category[r.category] = (category[r.category] ?? 0) + 1
      institution[r.institution] = (institution[r.institution] ?? 0) + 1
    }
    return { category, institution }
  }, [listed])

  const results = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    const filtered = listed.filter((r) => {
      if (q) {
        const hay = `${r.name} ${r.category} ${r.institution} ${r.description} ${r.location}`.toLowerCase()
        if (!q.split(/\s+/).every((t) => hay.includes(t))) return false
      }
      if (filters.categories.length && !filters.categories.includes(r.category)) return false
      if (filters.institutions.length && !filters.institutions.includes(r.institution)) return false
      if (filters.availability.length && !filters.availability.includes(r.availability)) return false
      if (filters.cost === 'free' && r.hourlyRate > 0) return false
      if (filters.cost === 'paid' && r.hourlyRate === 0) return false
      return true
    })
    const order = { available: 0, limited: 1, unavailable: 2 }
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'availability') return order[a.availability] - order[b.availability]
      if (sort === 'price') return a.hourlyRate - b.hourlyRate
      return 0
    })
  }, [listed, filters, sort])

  const activeChips = [
    ...filters.categories.map((v) => ({ key: `c-${v}`, label: v, remove: () => setFilters({ ...filters, categories: filters.categories.filter((c) => c !== v) }) })),
    ...filters.institutions.map((v) => ({ key: `i-${v}`, label: v, remove: () => setFilters({ ...filters, institutions: filters.institutions.filter((c) => c !== v) }) })),
    ...filters.availability.map((v) => ({ key: `a-${v}`, label: AVAILABILITY_LABEL[v], remove: () => setFilters({ ...filters, availability: filters.availability.filter((c) => c !== v) }) })),
    ...(filters.cost !== 'any'
      ? [{ key: 'cost', label: filters.cost === 'free' ? 'No charge' : 'Charged per hour', remove: () => setFilters({ ...filters, cost: 'any' }) }]
      : []),
  ]

  const clearAll = () =>
    setFilters({ q: '', categories: [], institutions: [], availability: [], cost: 'any' })

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="sticky top-24">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Filters</h2>
            {activeChips.length ? (
              <button type="button" onClick={clearAll} className="text-teal text-[13px] font-medium hover:underline">
                Clear all
              </button>
            ) : null}
          </div>
          <FilterPanel filters={filters} setFilters={setFilters} counts={counts} categories={categoryOptions} institutions={institutions} />
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
            <Input
              aria-label="Search resources"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Search by name, category, or institution"
              className="pl-9"
            />
          </div>
          <div className="flex gap-3">
            <div className="w-full sm:w-48">
              <NativeSelect aria-label="Sort results" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="relevance">Sort: Relevance</option>
                <option value="name">Sort: Name (A–Z)</option>
                <option value="availability">Sort: Availability</option>
                <option value="price">Sort: Lowest cost</option>
              </NativeSelect>
            </div>
            <Sheet>
              <SheetTrigger render={<Button variant="outline" className="lg:hidden" />}>
                <SlidersHorizontal />
                Filters
                {activeChips.length ? (
                  <span className="bg-navy ml-1 flex size-5 items-center justify-center rounded-full text-[11px] text-white">
                    {activeChips.length}
                  </span>
                ) : null}
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] gap-0 p-0">
                <SheetHeader className="border-line border-b p-4">
                  <SheetTitle className="text-navy">Filters</SheetTitle>
                  <SheetDescription className="sr-only">Filter the resource catalogue</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  <FilterPanel filters={filters} setFilters={setFilters} counts={counts} categories={categoryOptions} institutions={institutions} />
                </div>
                <SheetFooter className="border-line border-t p-4">
                  <Button variant="outline" onClick={clearAll}>
                    Clear all filters
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2" aria-live="polite">
          <p className="text-ink-muted mr-1 text-[13px]">
            <span className="text-ink font-semibold">{results.length}</span>{' '}
            {results.length === 1 ? 'resource' : 'resources'} found
          </p>
          {activeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.remove}
              className="bg-surface text-navy hover:bg-line inline-flex h-7 items-center gap-1.5 rounded-full pr-2 pl-3 text-xs font-medium transition-colors"
            >
              {c.label}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
        </div>

        {results.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={PackageSearch}
              title="No resources match these filters"
              description="Try removing a filter or searching for a broader term such as the equipment type."
              action={
                <Button variant="outline" onClick={clearAll}>
                  Clear all filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((r) => (
              <ResourceCard key={r.id} resource={r} href={`${basePath}/${r.id}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
