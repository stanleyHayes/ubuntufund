import { afterEach, describe, expect, it, vi } from 'vitest'

// The reconciliation timer used to require NODE_ENV=production, so staging
// could never run it and there was no way to opt in (I037).
describe('reconciliation scheduler flag', () => {
  const original = { NODE_ENV: process.env.NODE_ENV, RECONCILIATION_SCHEDULER_ENABLED: process.env.RECONCILIATION_SCHEDULER_ENABLED }
  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV
    if (original.RECONCILIATION_SCHEDULER_ENABLED === undefined) delete process.env.RECONCILIATION_SCHEDULER_ENABLED
    else process.env.RECONCILIATION_SCHEDULER_ENABLED = original.RECONCILIATION_SCHEDULER_ENABLED
    vi.unstubAllEnvs()
    vi.resetModules()
  })
  async function load() {
    // config/index.ts needs these at import; CI's Turbo run does not pass them
    // through and there is no apps/api/.env there (testApp.ts sets them for
    // the rest of the suite).
    vi.stubEnv('JWT_SECRET', process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production-0001')
    vi.stubEnv('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-do-not-use-in-production-0002')
    vi.stubEnv('MONGODB_URI', process.env.MONGODB_URI || 'mongodb://127.0.0.1:28017/config-test')
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
