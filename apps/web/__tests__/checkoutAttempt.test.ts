import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { checkoutAttemptKey, forgetCheckoutAttempt, isDefinitiveRejection } from '../src/lib/checkoutAttempt'

const storage: Record<string, unknown> = {}
beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key]
  Object.defineProperties(storage, {
    getItem: { configurable: true, value: (key: string) => storage[key] ?? null },
    setItem: { configurable: true, value: (key: string, value: string) => { storage[key] = value } },
    removeItem: { configurable: true, value: (key: string) => { delete storage[key] } },
  })
  vi.stubGlobal('sessionStorage', storage)
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => { vi.unstubAllGlobals() })

const donation = { amount: 50, donorEmail: 'private@example.test', message: 'For the clinic' }

// I006/I041: a retry of the same donation must reuse its key, so the server
// resolves it to the same wallet debit or the same open checkout.
it('reuses the key while the donation is unchanged and rotates it when details change', async () => {
  const key = await checkoutAttemptKey('donate:campaign-1', donation)
  expect(await checkoutAttemptKey('donate:campaign-1', { ...donation })).toBe(key)
  const changed = await checkoutAttemptKey('donate:campaign-1', { ...donation, amount: 60 })
  expect(changed).not.toBe(key)
  expect(await checkoutAttemptKey('donate:campaign-2', { ...donation, amount: 60 })).not.toBe(changed)
})

it('starts a new attempt once the previous one is forgotten', async () => {
  const key = await checkoutAttemptKey('wallet-donate:c', donation)
  await forgetCheckoutAttempt('wallet-donate:c')
  expect(await checkoutAttemptKey('wallet-donate:c', donation)).not.toBe(key)
})

it('never stores donor details, only opaque digests', async () => {
  await checkoutAttemptKey('donate:campaign-1', donation)
  const saved = JSON.stringify(storage)
  expect(saved).not.toContain('private@example.test')
  expect(saved).not.toContain('For the clinic')
  expect(saved).not.toContain('campaign-1')
})

it('keeps working for the page when session storage is unavailable', async () => {
  vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } })
  const key = await checkoutAttemptKey('blocked', donation)
  expect(await checkoutAttemptKey('blocked', donation)).toBe(key)
})

it.each([
  [{ status: 400 }, true], [{ status: 401 }, true], [{ status: 409 }, true], [{ status: 422 }, true],
  [{ status: 408 }, false], [{ status: 500 }, false], [{ status: 502 }, false], [{ status: 0 }, false],
  [new TypeError('Failed to fetch'), false], [null, false],
])('classifies %j as a definite rejection: %s', (error, expected) => {
  expect(isDefinitiveRejection(error)).toBe(expected)
})
