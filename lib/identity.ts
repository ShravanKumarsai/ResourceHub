export interface AccountIdentity {
  name: string
  initials: string
  email: string
  institutionName: string | null
}

export function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase()
  return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase()
}

export function resolveDisplayName(input: {
  profileName?: string | null
  metadata?: Record<string, unknown> | null
  email?: string | null
}) {
  const candidates = [
    input.profileName,
    input.metadata?.full_name,
    input.metadata?.display_name,
    input.metadata?.name,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  const local = input.email?.split('@')[0]?.trim()
  return local || 'Account'
}
