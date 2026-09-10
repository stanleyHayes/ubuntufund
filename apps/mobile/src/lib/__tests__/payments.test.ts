import { beforeEach, describe, expect, it, vi } from 'vitest'
const { data, post } = vi.hoisted(() => ({ data: new Map<string, string>(), post: vi.fn() }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v) }, getAllKeys: async () => [...data.keys()], multiRemove: async (keys: string[]) => { keys.forEach(k => data.delete(k)) },
} }))
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }))
vi.mock('../api', () => ({ api: { post } }))
vi.mock('../session', () => ({ sessionSnapshot: () => ({ user: { id: 'ama' } }) }))
import { paymentKey, checkout, loadPending, clearPending, isPaymentSuccess, cryptoStatusFromIntent } from '../payments'
beforeEach(() => { data.clear(); post.mockReset() })
describe('mobile payment recovery', () => {
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
