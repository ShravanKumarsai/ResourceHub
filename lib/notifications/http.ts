export async function readJsonBody(
  request: Request,
  maxBytes = 4096,
): Promise<unknown | null> {
  const text = await request.text()

  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get('origin')
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = (forwardedHost || request.headers.get('host'))?.split(',')[0]?.trim()
  const site = request.headers.get('sec-fetch-site')

  if (!origin || !host || site === 'cross-site') {
    return false
  }

  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}
