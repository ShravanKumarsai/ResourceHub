'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { CONDITION_LABEL } from '@/lib/format'
import type { ConditionRating, ConditionReport } from '@/lib/types'

const CHECKLIST = {
  out: ['Equipment powered on and functional', 'Accessories and consumables present', 'No visible damage', 'Safety briefing acknowledged'],
  in: ['Workspace cleaned', 'Equipment powered down', 'Accessories returned', 'No damage observed'],
}

export function ConditionDialog({
  open,
  onOpenChange,
  mode,
  resourceName,
  recordedBy,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'out' | 'in'
  resourceName: string
  recordedBy: string
  onSubmit: (report: ConditionReport) => boolean
}) {
  const [rating, setRating] = useState<ConditionRating>('good')
  const [notes, setNotes] = useState('')
  const [checked, setChecked] = useState<string[]>([])
  const [submitError, setSubmitError] = useState('')
  const items = CHECKLIST[mode]

  function toggle(item: string) {
    setChecked((c) => (c.includes(item) ? c.filter((x) => x !== item) : [...c, item]))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (checked.length === 0) {
      setSubmitError('Select at least one checklist item.')
      return
    }
    if (rating === 'damaged' && notes.trim().length < 10) {
      setSubmitError('Describe the damage in at least 10 characters.')
      return
    }
    const saved = onSubmit({
      rating,
      notes: notes.trim(),
      checklist: checked,
      recordedAt: new Date().toISOString(),
      recordedBy,
    })
    if (!saved) return
    setRating('good')
    setNotes('')
    setChecked([])
    setSubmitError('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {mode === 'out' ? 'Check out' : 'Check in'}: {resourceName}
            </DialogTitle>
            <DialogDescription>
              Record the condition of the resource {mode === 'out' ? 'before you start' : 'on return'}. This report is
              stored with the booking.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label htmlFor={`rating-${mode}`} className="mb-1.5 block text-sm font-medium">
              Condition
            </label>
            <NativeSelect
              id={`rating-${mode}`}
              value={rating}
              onChange={(e) => setRating(e.target.value as ConditionRating)}
            >
              {(Object.keys(CONDITION_LABEL) as ConditionRating[]).map((r) => (
                <option key={r} value={r}>
                  {CONDITION_LABEL[r]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Checklist</legend>
            <div className="space-y-2">
              {items.map((item) => (
                <label key={item} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={checked.includes(item)}
                    onChange={() => toggle(item)}
                    className="accent-teal size-4"
                  />
                  {item}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`notes-${mode}`} className="mb-1.5 block text-sm font-medium">
              Notes <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <Textarea
              id={`notes-${mode}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the next user or the owner should know"
              rows={3}
            />
          </div>

          {checked.length === 0 ? <p role="status" className="text-ink-muted text-xs">Select at least one checklist item before submitting.</p> : null}
          {rating === 'damaged' && notes.trim().length < 10 ? <p role="status" className="text-ink-muted text-xs">Describe the damage in at least 10 characters.</p> : null}
          {submitError ? <p role="alert" className="text-status-rejected text-sm">{submitError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={checked.length === 0 || (rating === 'damaged' && notes.trim().length < 10)}>{mode === 'out' ? 'Confirm check-out' : 'Confirm check-in'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
