import { beforeEach, describe, expect, it, vi } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage'
const { data, post } = vi.hoisted(() => ({ data: new Map<string, string>(), post: vi.fn() }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v) }, getAllKeys: async () => [...data.keys()], multiRemove: async (keys: string[]) => { keys.forEach(k => data.delete(k)) },
} }))
vi.mock('expo-crypto', async () => {
  const { createHash } = await import('node:crypto')
  return { randomUUID: () => crypto.randomUUID(), CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: async (_algorithm: string, input: string) => createHash('sha256').update(input).digest('hex') }
})
vi.mock('../api', () => ({ api: { post } }))
vi.mock('../session', () => ({ sessionSnapshot: () => ({ user: { id: 'ama' } }) }))
import { paymentKey, checkout, loadPending, clearPending, isPaymentSuccess, cryptoStatusFromIntent, canStartOver, STALE_PAYMENT_MS } from '../payments'
beforeEach(() => { data.clear(); post.mockReset() })
describe('mobile payment recovery', () => {
  it('keeps contact details and messages out of persisted request keys', async () => {
    const input = { amount: 10, donorEmail: 'private@example.test', message: 'Personal fundraising message' }
    const key = await paymentKey('campaign', input)
    expect(await paymentKey('campaign', input)).toBe(key)
    expect([...data.keys()]).toHaveLength(1)
    expect([...data.keys()][0]).toMatch(/^campaign:request-sha256:[a-f0-9]{64}$/)
    expect(JSON.stringify([...data])).not.toContain(input.donorEmail)
    expect(JSON.stringify([...data])).not.toContain(input.message)
    expect(await paymentKey('campaign', { ...input, amount: 11 })).not.toBe(key)
  })
  it('migrates a legacy request without creating a second payment attempt', async () => {
    const input = { amount: 10, donorEmail: 'private@example.test' }
    const legacy = `campaign:request:${JSON.stringify(input)}`
    data.set(legacy, 'original-attempt')
    expect(await paymentKey('campaign', input)).toBe('original-attempt')
    expect(data.has(legacy)).toBe(false)
    expect([...data.values()]).toEqual(['original-attempt'])
  })
  it('preserves conflicting legacy and hashed attempts and prevents another checkout', async () => {
    const input = { amount: 10, donorEmail: 'private@example.test' }
    const current = await paymentKey('campaign', input)
    const legacy = `campaign:request:${JSON.stringify(input)}`
    data.set(legacy, 'different-original-attempt')
    const original = [...data]
    await expect(checkout('campaign', '/donation-intents', input)).rejects.toThrow('Two saved attempts')
    expect(post).not.toHaveBeenCalled()
    expect([...data]).toEqual(original)
    expect([...data.values()]).toContain(current)
  })
  it.each(['', '   '])('preserves an unreadable saved request identity (%j) without creating a new attempt', async value => {
    const input = { amount: 10 }
    await paymentKey('campaign', input)
    const key = [...data.keys()][0]
    data.set(key, value)
    await expect(checkout('campaign', '/donation-intents', input)).rejects.toThrow('could not be read')
    expect(data.get(key)).toBe(value)
    expect(post).not.toHaveBeenCalled()
  })
  it('removes a redundant plaintext key only when both records identify the same attempt', async () => {
    const input = { amount: 10, donorEmail: 'private@example.test' }
    const current = await paymentKey('campaign', input)
    const legacy = `campaign:request:${JSON.stringify(input)}`
    data.set(legacy, current)
    expect(await paymentKey('campaign', input)).toBe(current)
    expect(data.has(legacy)).toBe(false)
    expect([...data.values()]).toEqual([current])
  })
  it('preserves the original attempt if migration cannot be saved', async () => {
    const input = { amount: 10, donorEmail: 'private@example.test' }
    const legacy = `campaign:request:${JSON.stringify(input)}`
    data.set(legacy, 'original-attempt')
    const failure = vi.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage unavailable'))
    try { await expect(paymentKey('campaign', input)).rejects.toThrow('Storage unavailable') }
    finally { failure.mockRestore() }
    expect(data.get(legacy)).toBe('original-attempt')
    expect(await paymentKey('campaign', input)).toBe('original-attempt')
    expect(data.has(legacy)).toBe(false)
  })
  it('reuses a persisted idempotency key after an ambiguous checkout failure', async () => {
    post.mockRejectedValueOnce(new Error('network interrupted')).mockResolvedValueOnce({ intent: { id: 'intent-1', status: 'PENDING' }, reference: 'uf-intent-1-reference', authorization_url: 'https://checkout.test/1' })
    await expect(checkout('campaign', '/donation-intents', { amount: 100 })).rejects.toThrow()
    const payment = await checkout('campaign', '/donation-intents', { amount: 100 })
    expect(post.mock.calls[0][2]).toEqual(post.mock.calls[1][2])
    expect(await loadPending('campaign')).toEqual(payment)
    expect(payment.reference).toBe('uf-intent-1-reference')
    expect(isPaymentSuccess(payment.status)).toBe(false)
  })
  it('shares keys for concurrent submissions but resets them for an explicitly new payment', async () => {
    const keys = await Promise.all([paymentKey('campaign', { amount: 10 }), paymentKey('campaign', { amount: 10 })])
    expect(keys[0]).toBe(keys[1])
    await clearPending('campaign')
    expect(await paymentKey('campaign', { amount: 10 })).not.toBe(keys[0])
  })
  it('tracks topups by reference and never equates a pending checkout to success', async () => {
    post.mockResolvedValue({ reference: 'topup-1', status: 'pending', authorizationUrl: 'https://checkout.test/1' })
    const payment = await checkout('wallet', '/wallets/topups', { amount: 100 }, true)
    expect(payment.id).toBe('topup-1')
    expect(isPaymentSuccess(payment.status)).toBe(false)
    expect(isPaymentSuccess('completed')).toBe(true)
  })
})

it('maps server crypto states without treating unknown or processing states as paid', () => {
  expect(cryptoStatusFromIntent('PROCESSING')).toBe('PENDING_CONFIRMATION')
  expect(cryptoStatusFromIntent('SUCCEEDED')).toBe('CONFIRMED')
  expect(cryptoStatusFromIntent('CANCELLED')).toBe('FAILED')
  expect(cryptoStatusFromIntent('unrecognised')).toBeUndefined()
  expect(isPaymentSuccess(cryptoStatusFromIntent('PROCESSING')!)).toBe(false)
})

for (const raw of ['{', 'null', '[]', '{}', JSON.stringify({ id: 'intent-1', status: 'PENDING', storageKey: 'another-account' }), JSON.stringify({ id: 'intent-1', status: 'PENDING', storageKey: 'campaign', authorizationUrl: 42 })]) {
  it(`preserves unreadable recovery state and prevents checkout: ${raw}`, async () => {
    data.set('campaign:pending', raw)
    await expect(loadPending('campaign')).rejects.toThrow('saved payment could not be read')
    await expect(checkout('campaign', '/donation-intents', { amount: 10 })).rejects.toThrow('saved payment could not be read')
    expect(post).not.toHaveBeenCalled()
    expect([...data]).toEqual([['campaign:pending', raw]])
  })
}

describe('stale unconfirmed payments (I038)', () => {
  it('offers a new payment only for a non-final payment older than the threshold', () => {
    const now = 1_000_000_000
    expect(canStartOver('PENDING', now - STALE_PAYMENT_MS, now)).toBe(true)
    expect(canStartOver('pending', now - STALE_PAYMENT_MS - 1, now)).toBe(true)
    expect(canStartOver('PENDING', now - STALE_PAYMENT_MS + 1000, now)).toBe(false)
    for (const done of ['SUCCEEDED', 'FAILED', 'EXPIRED', 'completed', 'failed']) expect(canStartOver(done, 0, now)).toBe(false)
  })
  it('stamps new checkouts and still reads older saved attempts without a timestamp', async () => {
    post.mockResolvedValueOnce({ intent: { id: 'intent-1', status: 'PENDING' }, reference: 'uf-1' })
    const saved = await checkout('stamp', '/donation-intents', { amount: 5 })
    expect(typeof saved.createdAt).toBe('number')
    expect((await loadPending('stamp'))?.createdAt).toBe(saved.createdAt)
    data.set('legacy:pending', JSON.stringify({ id: 'x', status: 'PENDING', storageKey: 'legacy' }))
    expect((await loadPending('legacy'))?.createdAt).toBeUndefined()
    data.set('bad:pending', JSON.stringify({ id: 'x', status: 'PENDING', storageKey: 'bad', createdAt: 'yesterday' }))
    await expect(loadPending('bad')).rejects.toThrow()
  })
})
