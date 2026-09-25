import { afterEach, describe, expect, it, vi } from 'vitest'

// The reconciliation timer used to require NODE_ENV=production, so staging
// could never run it and there was no way to opt in (I037).
describe('reconciliation scheduler flag', () => {
  const original = { NODE_ENV: process.env.NODE_ENV, RECONCILIATION_SCHEDULER_ENABLED: process.env.RECONCILIATION_SCHEDULER_ENABLED }
  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV
    if (original.RECONCILIATION_SCHEDULER_ENABLED === undefined) delete process.env.RECONCILIATION_SCHEDULER_ENABLED
    else process.env.RECONCILIATION_SCHEDULER_ENABLED = original.RECONCILIATION_SCHEDULER_ENABLED
    vi.resetModules()
  })
  async function load() {
    vi.resetModules()
    return (await import('../../src/infrastructure/config/index.js')).config
  }

  it('is off outside production unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.RECONCILIATION_SCHEDULER_ENABLED
    expect((await load()).payments.reconciliationSchedulerEnabled).toBe(false)
    process.env.RECONCILIATION_SCHEDULER_ENABLED = 'true'
    expect((await load()).payments.reconciliationSchedulerEnabled).toBe(true)
  })
})
