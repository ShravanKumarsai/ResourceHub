'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { ImagePlus, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { removeResourceImage, saveResource, setResourceImagePath } from '@/app/owner/resources/actions'
import { PageHeader, SectionCard } from '@/components/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { AVAILABILITY_LABEL } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, type Availability, type Category, type Resource, type ResourceOwnerMembership } from '@/lib/types'

const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const normalizeCategoryValue = (value: string) => value.replace(/\s+/g, ' ').trim()

function hasValidImageSignature(header: Uint8Array, type: string) {
  if (type === 'image/png') {
    return header.length >= 8 && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47
  }

  if (type === 'image/jpeg') {
    return header.length >= 2 && header[0] === 0xff && header[1] === 0xd8
  }

  if (type === 'image/webp') {
    return (
      header.length >= 12 &&
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    )
  }

  return false
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-ink-muted mt-1.5 text-xs">{hint}</p> : null}
    </div>
  )
}

export function ResourceForm({
  resource,
  ownerMemberships,
  resourceCategories,
}: {
  resource?: Resource | null
  ownerMemberships?: ResourceOwnerMembership[]
  resourceCategories?: string[]
}) {
  const router = useRouter()
  const memberships = ownerMemberships ?? []
  const [membershipId, setMembershipId] = useState(resource?.ownerMembershipId ?? memberships[0]?.id ?? '')
  const [name, setName] = useState(resource?.name ?? '')
  const [category, setCategory] = useState<Category>(resource?.category ?? resourceCategories?.[0] ?? CATEGORIES[0])
  const [location, setLocation] = useState(resource?.location ?? '')
  const [description, setDescription] = useState(resource?.description ?? '')
  const [availability, setAvailability] = useState<Availability>(resource?.availability ?? 'available')
  const [rate, setRate] = useState(String(resource?.hourlyRate ?? 0))
  const [maxHours, setMaxHours] = useState(String(resource?.maxDurationHours ?? 4))
  const [approval, setApproval] = useState<Resource['approval']>(resource?.approval ?? 'Owner approval')
  const [specs, setSpecs] = useState(resource?.specs.map((spec) => `${spec.label}: ${spec.value}`).join('\n') ?? '')
  const [highlights, setHighlights] = useState(resource?.highlights.join('\n') ?? '')
  const [eligibility, setEligibility] = useState(resource?.eligibility.join('\n') ?? '')
  const [training, setTraining] = useState(resource?.training.join('\n') ?? '')
  const [safety, setSafety] = useState(resource?.safety.join('\n') ?? '')
  const [useCases, setUseCases] = useState(resource?.useCases.join('\n') ?? '')
  const [instructions, setInstructions] = useState(resource?.instructions.join('\n') ?? '')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(resource?.image ?? '')
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categoryOptions = useMemo(() => {
    const normalizedOptions = new Map<string, string>()
    for (const option of [...(resourceCategories ?? []), ...CATEGORIES, category]) {
      const normalized = normalizeCategoryValue(option)
      if (!normalized) continue
      const key = normalized.toLowerCase()
      if (!normalizedOptions.has(key)) normalizedOptions.set(key, normalized)
    }
    return [...normalizedOptions.values()].sort((a, b) => a.localeCompare(b))
  }, [category, resourceCategories])

  const validateImage = async (file: File | null) => {
    if (!file) {
      setSelectedFile(null)
      setFileError(null)
      return
    }

    const mime = file.type.toLowerCase()
    if (!ACCEPTED_IMAGE_TYPES.includes(mime)) {
      setSelectedFile(null)
      setFileError('Only PNG, JPEG, and WebP images are supported.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null)
      setFileError('Image files must be 5 MB or smaller.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    try {
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())
      if (!hasValidImageSignature(header, mime) || header.length === 0) {
        throw new Error('Invalid image content.')
      }

      await createImageBitmap(file)
    } catch {
      setSelectedFile(null)
      setFileError('The selected file is not a valid PNG, JPEG, or WebP image.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setSelectedFile(file)
    setFileError(null)
    setImagePreview(URL.createObjectURL(file))
  }

  async function submit(listed: boolean) {
    const next: Record<string, string> = {}
    const normalizedCategory = normalizeCategoryValue(category)
    if (!membershipId) next.membership = 'Choose an active resource-owner membership.'
    if (!name.trim()) next.name = 'Enter a resource name.'
    if (!normalizedCategory) next.category = 'Choose or create a category.'
    if (!location.trim()) next.location = 'Enter the building and room.'
    if (description.trim().length < 20) next.description = 'Add a description of at least 20 characters.'
    const hourlyRate = Number(rate)
    const maximumHours = Number(maxHours)
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) next.rate = 'Enter a finite rate of 0 or more.'
    if (!Number.isSafeInteger(maximumHours) || maximumHours < 1) next.maxHours = 'Enter a whole number of hours (at least 1).'
    setErrors(next)
    if (Object.keys(next).length) {
      toast.error('Check the required fields before saving.', {
        description: 'Some details still need attention.',
      })
      return
    }

    setUploading(true)
    try {
      const saved = await saveResource({
        id: resource?.id,
        ownerMembershipId: membershipId,
        name: name.trim(),
        category: normalizedCategory as Category,
        location: location.trim(),
        description: description.trim(),
        availability,
        hourlyRate,
        maxDurationHours: Number(maxHours),
        approval,
        specs: lines(specs).map((line) => {
          const [label, ...rest] = line.split(':')
          return rest.length ? { label: label.trim(), value: rest.join(':').trim() } : { label: 'Detail', value: line }
        }),
        highlights: lines(highlights),
        eligibility: lines(eligibility),
        training: lines(training),
        safety: lines(safety),
        useCases: lines(useCases),
        instructions: lines(instructions),
        listed,
        hasNewImage: !!selectedFile,
      })

      let finalImagePath: string | null = resource?.image ? null : null
      if (selectedFile) {
        const supabase = createClient()
        const extension = selectedFile.name.split('.').pop()?.toLowerCase() || 'png'
        const safeName = `${crypto.randomUUID()}.${extension}`
        const uploadPath = `${saved.id}/${safeName}`
        const { error: uploadError } = await supabase.storage.from('resource-images').upload(uploadPath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: selectedFile.type || 'image/png',
        })

        if (uploadError) {
          throw new Error('The image could not be uploaded to the resource-images bucket.')
        }

        finalImagePath = uploadPath
        try {
          await setResourceImagePath(saved.id, uploadPath, listed)
          if (saved.previousImagePath && saved.previousImagePath !== uploadPath) {
            const { error: removeError } = await supabase.storage.from('resource-images').remove([saved.previousImagePath])
            if (removeError) {
              toast.warning('The new image was saved, but the old image could not be removed automatically. Please review the image cleanup.')
            }
          }
        } catch (error) {
          await supabase.storage.from('resource-images').remove([uploadPath])
          throw error
        }
      }

      toast.success(listed ? 'Resource saved' : 'Draft saved', {
        description: finalImagePath ? 'The resource and image are now connected.' : 'The resource record was saved successfully.',
      })
      router.push('/owner/resources')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The resource could not be saved.'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveImage() {
    if (resource?.imagePath) {
      setUploading(true)
      try {
        await removeResourceImage(resource.id)
        setImagePreview('')
        toast.success('Image removed from this resource.')
        router.refresh()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'The image could not be removed.')
      } finally {
        setUploading(false)
      }
      return
    }

    setSelectedFile(null)
    setFileError(null)
    setImagePreview(resource?.image ?? '')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const err = (key: string) =>
    errors[key] ? (
      <p role="alert" className="text-status-rejected mt-1.5 text-xs">
        {errors[key]}
      </p>
    ) : null

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void submit(true)
      }}
      className="space-y-6"
      noValidate
    >
      <PageHeader
        title={resource ? 'Edit resource' : 'Add a resource'}
        description="Create and maintain resource listings using the authenticated institution ownership model."
      />

      <SectionCard title="Basic information" description="Set the core details that will define the resource for students and owners.">
        <div className="grid gap-5 md:grid-cols-2">
          {memberships.length > 1 ? (
            <div className="md:col-span-2">
              <Field id="rf-membership" label="Institution membership">
                <NativeSelect id="rf-membership" value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
                  {memberships.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.institutionName}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          ) : null}

          <Field id="rf-name" label="Resource name">
            <Input id="rf-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
            {err('name')}
          </Field>

          <Field id="rf-category" label="Category" hint="Choose an existing category or type a new one.">
            <Input
              id="rf-category"
              list="resource-categories"
              value={category}
              onChange={(e) => setCategory(normalizeCategoryValue(e.target.value) as Category)}
              aria-invalid={!!errors.category}
            />
            <datalist id="resource-categories">
              {categoryOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            {err('category')}
          </Field>

          <Field id="rf-location" label="Location" hint="Building, suite and room details.">
            <Input id="rf-location" value={location} onChange={(e) => setLocation(e.target.value)} aria-invalid={!!errors.location} />
            {err('location')}
          </Field>

          <Field id="rf-availability" label="Availability">
            <NativeSelect id="rf-availability" value={availability} onChange={(e) => setAvailability(e.target.value as Availability)}>
              {(Object.keys(AVAILABILITY_LABEL) as Availability[]).map((option) => (
                <option key={option} value={option}>
                  {AVAILABILITY_LABEL[option]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div className="md:col-span-2">
            <Field id="rf-description" label="Description">
              <Textarea
                id="rf-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={!!errors.description}
              />
              {err('description')}
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Resource image" description="Upload a PNG, JPEG or WebP image up to 5 MB.">
        <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-dashed border-line bg-surface p-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void validateImage(event.target.files?.[0] ?? null)}
              className="hidden"
              id="resource-image-upload"
            />
            <label htmlFor="resource-image-upload" className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-line bg-white px-4 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-teal-soft text-teal">
                <ImagePlus className="size-5" />
              </span>
              <span className="text-sm font-medium">Upload an image from your device</span>
              <span className="text-ink-muted text-xs">PNG, JPEG or WebP · up to 5 MB</span>
            </label>
            {fileError ? <p className="text-status-rejected mt-3 text-xs">{fileError}</p> : null}
            {(selectedFile || resource?.imagePath) ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
                <span className="truncate">{selectedFile ? selectedFile.name : 'Current image'}</span>
                <button
                  type="button"
                  className="ml-2 inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                  onClick={() => void handleRemoveImage()}
                  disabled={uploading}
                >
                  <X className="size-4" />
                  Remove
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-3">
            {imagePreview ? (
              <img src={imagePreview} alt={name || 'Resource preview'} className="h-full max-h-52 w-full rounded-lg object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-ink-muted">
                <UploadCloud className="size-8" />
                <span className="text-xs">No image selected</span>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Booking rules">
        <div className="grid gap-5 md:grid-cols-3">
          <Field id="rf-rate" label="Hourly rate (£)" hint="Enter 0 for no charge.">
            <Input id="rf-rate" type="number" min={0} step="1" value={rate} onChange={(e) => setRate(e.target.value)} />
            {err('rate')}
          </Field>
          <Field id="rf-max" label="Maximum session (hours)">
            <Input id="rf-max" type="number" min={1} step="1" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} />
            {err('maxHours')}
          </Field>
          <Field id="rf-approval" label="Approval">
            <NativeSelect id="rf-approval" value={approval} onChange={(e) => setApproval(e.target.value as Resource['approval'])}>
              <option>Owner approval</option>
              <option>Automatic confirmation</option>
            </NativeSelect>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Details" description="Enter one item per line.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="rf-specs" label="Specifications" hint="Use “Label: value” on each line.">
            <Textarea id="rf-specs" rows={5} value={specs} onChange={(e) => setSpecs(e.target.value)} />
          </Field>
          <Field id="rf-highlights" label="Highlights">
            <Textarea id="rf-highlights" rows={5} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
          </Field>
          <Field id="rf-eligibility" label="Eligibility">
            <Textarea id="rf-eligibility" rows={4} value={eligibility} onChange={(e) => setEligibility(e.target.value)} />
          </Field>
          <Field id="rf-training" label="Required training">
            <Textarea id="rf-training" rows={4} value={training} onChange={(e) => setTraining(e.target.value)} />
          </Field>
          <Field id="rf-safety" label="Safety requirements">
            <Textarea id="rf-safety" rows={4} value={safety} onChange={(e) => setSafety(e.target.value)} />
          </Field>
          <Field id="rf-usecases" label="Typical use cases">
            <Textarea id="rf-usecases" rows={4} value={useCases} onChange={(e) => setUseCases(e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field id="rf-instructions" label="Usage instructions">
              <Textarea id="rf-instructions" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
            </Field>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href="/owner/resources" className={buttonVariants({ variant: 'ghost' })}>
          Cancel
        </Link>
        <Button type="button" variant="outline" onClick={() => void submit(false)} disabled={uploading}>
          {uploading ? 'Saving…' : 'Save as draft'}
        </Button>
        <Button type="submit" disabled={uploading}>
          {uploading ? 'Saving…' : resource ? 'Save changes' : 'Publish resource'}
        </Button>
      </div>
    </form>
  )
}
