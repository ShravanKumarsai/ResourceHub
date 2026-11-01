import assert from 'node:assert/strict'
import test from 'node:test'
import { escapeHtml, processClaimedNotificationJobs } from './delivery-core.ts'

test('escapes content before email HTML interpolation', () => {
  assert.equal(escapeHtml(`<script>&"it's`), '&lt;script&gt;&amp;&quot;it&#39;s')
})

test('keeps channel outcomes independent and continues after provider errors', async () => {
  const jobs = [
    { id: 'email-job', channel: 'email' },
    { id: 'push-job', channel: 'push' },
    { id: 'retry-job', channel: 'email' },
  ]
  const finished = []
  const summary = await processClaimedNotificationJobs(jobs, {
    async deliver(job) {
      if (job.id === 'email-job') return { outcome: 'sent' }
      if (job.id === 'push-job') return { outcome: 'skipped', errorCode: 'no_subscription' }
      throw new Error('provider details must not leak')
    },
    async finish(job, result) {
      finished.push({ id: job.id, ...result })
      return true
    },
  })

  assert.deepEqual(finished, [
    { id: 'email-job', outcome: 'sent' },
    { id: 'push-job', outcome: 'skipped', errorCode: 'no_subscription' },
    { id: 'retry-job', outcome: 'retry', errorCode: 'provider_error' },
  ])
  assert.deepEqual(summary, {
    claimed: 3,
    sent: 1,
    retrying: 1,
    skipped: 1,
    finishErrors: 0,
  })
})

test('bounds concurrent provider work', async () => {
  let active = 0
  let peak = 0
  const jobs = Array.from({ length: 12 }, (_, index) => ({ id: String(index), channel: 'email' }))

  await processClaimedNotificationJobs(jobs, {
    async deliver() {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active -= 1
      return { outcome: 'sent' }
    },
    async finish() {
      return true
    },
  })

  assert.equal(peak, 4)
})
