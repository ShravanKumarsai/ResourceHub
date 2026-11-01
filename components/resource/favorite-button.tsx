'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { toast } from 'sonner'
import { getFavoriteStatus, setResourceFavorite } from '@/app/favorites/actions'
import { Button } from '@/components/ui/button'

export function FavoriteButton({
  resourceId,
  initialSaved,
  compact = false,
}: {
  resourceId: string
  initialSaved?: boolean
  compact?: boolean
}) {
  const router = useRouter()
  const [saved, setSaved] = useState<boolean | null>(initialSaved ?? null)
  const [pending, setPending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (initialSaved !== undefined) {
      setSaved(initialSaved)
      setLoadError(null)
      return
    }

    let active = true
    setLoadError(null)
    void getFavoriteStatus(resourceId)
      .then((status) => {
        if (active) setSaved(status.saved)
      })
      .catch(() => {
        if (active) {
          setSaved(null)
          setLoadError('Saved status could not be loaded.')
        }
      })

    return () => {
      active = false
    }
  }, [initialSaved, resourceId])

  async function toggleFavorite() {
    if (saved === null || pending) return

    setPending(true)
    try {
      const nextSaved = !saved
      const result = await setResourceFavorite(resourceId, nextSaved)
      if (!result.authenticated) {
        router.push('/login')
        return
      }

      setSaved(result.saved)
      router.refresh()
      toast.success(result.saved ? 'Saved to your resources' : 'Removed from saved resources')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update saved resources.')
    } finally {
      setPending(false)
    }
  }

  const label = saved ? 'Remove from saved resources' : 'Save resource'
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={saved ? 'secondary' : 'outline'}
        size={compact ? 'icon-sm' : 'sm'}
        aria-label={label}
        aria-pressed={saved === true}
        disabled={saved === null || pending}
        onClick={() => void toggleFavorite()}
        className={compact ? 'bg-white/95 shadow-sm' : undefined}
      >
        {saved ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        {!compact ? <span>{saved ? 'Saved' : 'Save resource'}</span> : <span className="sr-only">{label}</span>}
      </Button>
      {loadError ? <span role="alert" className="text-status-rejected text-xs">{loadError}</span> : null}
    </div>
  )
}
