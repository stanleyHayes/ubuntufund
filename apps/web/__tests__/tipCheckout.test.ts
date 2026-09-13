import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { tipAttemptKey, rememberTipReference, finishTipAttempt } from '../src/lib/tipCheckout'

const storage: Record<string, unknown> = {}
beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key]
  Object.defineProperties(storage, {
    getItem: { configurable: true, value: (key: string) => storage[key] ?? null },
    setItem: { configurable: true, value: (key: string, value: string) => { storage[key] = value } },
    removeItem: { configurable: true, value: (key: string) => { delete storage[key] } },
  })
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => { vi.unstubAllGlobals() })
it('keeps the same attempt across retries and scopes it to the creator and viewer', async () => {
  const key = await tipAttemptKey('viewer', 'creator')
  expect(await tipAttemptKey('viewer', 'creator')).toBe(key)
  expect(await tipAttemptKey('other', 'creator')).not.toBe(key)
  expect(await tipAttemptKey('viewer', 'other')).not.toBe(key)
  expect(JSON.stringify(localStorage)).not.toContain('viewer')
  expect(JSON.stringify(localStorage)).not.toContain('creator')
})
it('only releases the attempt matching a confirmed reference', async () => {
  const key = await tipAttemptKey(undefined, 'creator')
  rememberTipReference(key, 'tip-confirmed')
  finishTipAttempt('tip-unrelated')
  expect(await tipAttemptKey(undefined, 'creator')).toBe(key)
  finishTipAttempt('tip-confirmed')
  expect(await tipAttemptKey(undefined, 'creator')).not.toBe(key)
})
it('does not silently create another attempt when durable storage is unavailable', async () => {
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('unavailable') })
  await expect(tipAttemptKey(undefined, 'creator')).rejects.toThrow('unavailable')
  spy.mockRestore()
})
