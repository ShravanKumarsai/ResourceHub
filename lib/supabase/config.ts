export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    const missingVariables: string[] = []
    if (!url) missingVariables.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!publishableKey) {
      missingVariables.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    }

    throw new Error(
      `Missing required Supabase environment variable(s): ${missingVariables.join(', ')}. Add them to .env.local and restart the Next.js development server.`,
    )
  }

  return { url, publishableKey }
}
