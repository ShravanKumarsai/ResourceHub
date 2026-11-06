'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateAccountabilitySettings } from '@/app/institution/settings/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader, SectionCard } from '@/components/page-header'

export function InstitutionAccountabilitySettings({
  initialSettings,
}: {
  initialSettings: {
    institutionName: string
    late_flag_threshold: number
    max_usage_duration_minutes: number | null
    timezone: string
  }
}) {
  const [threshold, setThreshold] = useState(String(initialSettings.late_flag_threshold))
  const [maxUsage, setMaxUsage] = useState(
    initialSettings.max_usage_duration_minutes === null
      ? ''
      : String(initialSettings.max_usage_duration_minutes),
  )
  const [timezone, setTimezone] = useState(initialSettings.timezone)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const thresholdValue = Number(threshold)
    const maxUsageValue = maxUsage === '' ? null : Number(maxUsage)
    if (
      !Number.isInteger(thresholdValue) ||
      thresholdValue < 1 ||
      thresholdValue > 100 ||
      (maxUsageValue !== null &&
        (!Number.isInteger(maxUsageValue) || maxUsageValue < 1 || maxUsageValue > 10080))
    ) {
      setError('Use a late-flag threshold from 1 to 100 and an optional maximum usage duration from 1 to 10,080 minutes.')
      setSaving(false)
      return
    }

    try {
      await updateAccountabilitySettings({
        lateFlagThreshold: thresholdValue,
        maxUsageDurationMinutes: maxUsageValue,
        timezone,
      })
      toast.success('Accountability settings saved')
    } catch (saveError) {
      const message = saveError instanceof Error
        ? saveError.message
        : 'Accountability settings could not be saved.'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accountability settings"
        description={`Configure late-return attention thresholds and deadlines for ${initialSettings.institutionName}.`}
      />
      <SectionCard
        title="Late returns"
        description="Changing the threshold takes effect immediately. Existing late flags remain in the audit history."
      >
        <form className="max-w-xl space-y-5" onSubmit={submit}>
          <div>
            <label htmlFor="late-flag-threshold" className="mb-1.5 block text-sm font-medium">
              Late flags before attention marker
            </label>
            <Input
              id="late-flag-threshold"
              type="number"
              min={1}
              max={100}
              step={1}
              required
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
            <p className="text-ink-muted mt-1 text-xs">Default: 5. Range: 1–100.</p>
          </div>
          <div>
            <label htmlFor="max-usage-duration" className="mb-1.5 block text-sm font-medium">
              Maximum permitted usage (minutes)
            </label>
            <Input
              id="max-usage-duration"
              type="number"
              min={1}
              max={10080}
              step={1}
              value={maxUsage}
              onChange={(event) => setMaxUsage(event.target.value)}
              placeholder="No additional institution limit"
            />
            <p className="text-ink-muted mt-1 text-xs">
              Optional. The deadline is the earlier of the approved booking end and check-out plus this limit.
            </p>
          </div>
          <div>
            <label htmlFor="institution-timezone" className="mb-1.5 block text-sm font-medium">
              Institution timezone
            </label>
            <Input
              id="institution-timezone"
              required
              maxLength={100}
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="e.g. Europe/London"
            />
            <p className="text-ink-muted mt-1 text-xs">
              Use an IANA timezone name such as <code>Europe/London</code> or <code>Asia/Kolkata</code>.
            </p>
          </div>
          {error ? <p role="alert" className="text-status-rejected text-sm">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      </SectionCard>
    </div>
  )
}
