import { timingSafeEqual } from 'node:crypto'

export function isAuthorizedCronRequest(
  authorization: string | null,
  expectedSecret: string | undefined,
) {
  const secret = expectedSecret?.trim()
  if (!secret || secret.length < 32 || !authorization?.startsWith('Bearer ')) {
    return false
  }

  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const expected = Buffer.from(secret)

  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
