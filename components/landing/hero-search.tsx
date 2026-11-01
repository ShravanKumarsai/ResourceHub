'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { CATEGORIES } from '@/lib/types'

export function HeroSearch({ institutions }: { institutions: string[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [institution, setInstitution] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (category) params.set('category', category)
    if (institution) params.set('institution', institution)
    const qs = params.toString()
    router.push(qs ? `/explore?${qs}` : '/explore')
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label="Search resources"
      className="border-line grid gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end"
    >
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="hero-q" className="text-ink mb-1.5 block text-xs font-medium">
          What do you need?
        </label>
        <Input
          id="hero-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. robotic arm, CNC, microscope"
        />
      </div>
      <div>
        <label htmlFor="hero-category" className="text-ink mb-1.5 block text-xs font-medium">
          Category
        </label>
        <NativeSelect id="hero-category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor="hero-institution" className="text-ink mb-1.5 block text-xs font-medium">
          Institution
        </label>
        <NativeSelect
          id="hero-institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
        >
          <option value="">All institutions</option>
          {institutions.map((institution) => (
            <option key={institution} value={institution}>
              {institution}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" size="lg" className="sm:col-span-2 lg:col-span-1">
        <Search />
        Search
      </Button>
    </form>
  )
}
