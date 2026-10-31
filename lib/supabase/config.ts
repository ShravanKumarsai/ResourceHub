type SupabaseConfig = {
  url: string
  publishableKey: string
}

function readSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (url && publishableKey) {
    return { url, publishableKey }
  }

  return null
}

export function getOptionalSupabaseConfig() {
  return readSupabaseConfig()
}

export function getSupabaseConfig(): SupabaseConfig {
  const config = readSupabaseConfig()

  if (config) {
    return config
  }

  const missingVariables: string[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missingVariables.push('NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    missingVariables.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  }

  throw new Error(
    `Missing required Supabase environment variable(s): ${missingVariables.join(', ')}. Add them to .env.local and restart the Next.js development server.`,
  )
}
