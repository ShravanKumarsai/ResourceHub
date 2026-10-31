type SupabaseErrorSummary = {
  code?: string
  message?: string
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi

function redactSensitiveValues(value: string) {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(UUID_PATTERN, '[redacted-id]')
    .slice(0, 400)
}

export function logSupabaseError(context: string, error: SupabaseErrorSummary) {
  if (process.env.NODE_ENV !== 'development') return

  console.error(`[ResourceHub] ${context}`, {
    code: error.code ?? 'unknown',
    message: redactSensitiveValues(error.message ?? 'No error message was provided.'),
  })
}
