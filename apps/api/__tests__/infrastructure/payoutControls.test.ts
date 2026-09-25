import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { payoutControlWarnings } from '../../src/infrastructure/config/payoutControls.js'

const renderYaml = readFileSync(fileURLToPath(new URL('../../../../render.yaml', import.meta.url)), 'utf8')
const renderValue = renderYaml.match(/- key: PAYOUT_DUAL_APPROVAL_AMOUNT\s*\n\s*value: "([^"]*)"/)?.[1]

describe('payout maker-checker configuration', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

  it('parses the committed render.yaml value to the threshold the API enforces', async () => {
    expect(renderValue).toBeDefined()
    vi.stubEnv('PAYOUT_DUAL_APPROVAL_AMOUNT', renderValue!)
    // config/index.ts needs these at import; CI's Turbo run does not pass them through.
    vi.stubEnv('JWT_SECRET', process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production-0001')
    vi.stubEnv('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-do-not-use-in-production-0002')
    vi.stubEnv('MONGODB_URI', process.env.MONGODB_URI || 'mongodb://127.0.0.1:28017/config-test')
    vi.resetModules()
    const { config } = await import('../../src/infrastructure/config/index.js')
    expect(config.payouts.dualApprovalAmount).toBe(Number(renderValue))
    expect(Number.isFinite(config.payouts.dualApprovalAmount)).toBe(true)
  })

  it('warns at production startup while single-admin approval is in force, and only then', () => {
    expect(payoutControlWarnings('production', { dualApprovalAmount: 0 })).toEqual([expect.stringMatching(/maker-checker is off/)])
    expect(payoutControlWarnings('production', { dualApprovalAmount: Number.NaN })).toHaveLength(1)
    expect(payoutControlWarnings('production', { dualApprovalAmount: 5000 })).toEqual([])
    expect(payoutControlWarnings('development', { dualApprovalAmount: 0 })).toEqual([])
  })
})
