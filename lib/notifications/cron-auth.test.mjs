import assert from 'node:assert/strict'
import test from 'node:test'
import { isAuthorizedCronRequest } from './cron-auth.ts'

const secret = 'a'.repeat(48)

test('requires a sufficiently long cron secret and matching bearer token', () => {
  assert.equal(isAuthorizedCronRequest(`Bearer ${secret}`, secret), true)
  assert.equal(isAuthorizedCronRequest(`Bearer ${secret}x`, secret), false)
  assert.equal(isAuthorizedCronRequest(secret, secret), false)
  assert.equal(isAuthorizedCronRequest(`Bearer ${'a'.repeat(31)}`, 'a'.repeat(31)), false)
  assert.equal(isAuthorizedCronRequest(`Bearer ${secret}`, undefined), false)
})
