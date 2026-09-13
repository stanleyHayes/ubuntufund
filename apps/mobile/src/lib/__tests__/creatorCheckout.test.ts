import { beforeEach, expect, it, vi } from 'vitest'
const { data, post, platform } = vi.hoisted(() => ({ data: new Map<string, string>(), post: vi.fn(), platform: { OS: 'web' } }))
vi.mock('react-native', () => ({ Platform: platform }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => data.get(key) ?? null,
  setItem: async (key: string, value: string) => { data.set(key, value) },
  getAllKeys: async () => [...data.keys()],
  multiRemove: async (keys: string[]) => { keys.forEach(key => data.delete(key)) },
} }))
vi.mock('expo-crypto', async () => {
  const { createHash } = await import('node:crypto')
  return { randomUUID: () => crypto.randomUUID(), CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: async (_algorithm: string, input: string) => createHash('sha256').update(input).digest('hex') }
})
vi.mock('../api', () => ({ api: { post } }))
vi.mock('../session', () => ({ sessionSnapshot: () => ({ user: { id: 'viewer' } }) }))
import { createTip, verifyTip } from '../creators'
const input = { amount: 25, supporterEmail: 'private@example.com', message: 'Public message', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }
const checkout = { checkoutUrl: 'https://checkout.test/private', reference: 'tip-reference', tipId: 'tip-id' }
beforeEach(() => { data.clear(); post.mockReset(); platform.OS = 'web' })
it('keeps the attempt after a lost response and forwards explicit message agreement without storing the draft', async () => {
  post.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(checkout)
  await expect(createTip('creator', input)).rejects.toThrow('network')
  await createTip('creator', input)
  expect(post.mock.calls[0][2]).toEqual(post.mock.calls[1][2])
  expect(post.mock.calls[1][1]).toEqual(input)
  expect(JSON.stringify([...data])).not.toContain('private@example.com')
  expect(JSON.stringify([...data])).not.toContain('Public message')
  expect(JSON.stringify([...data])).not.toContain(checkout.checkoutUrl)
})
it('releases only a matching terminal payment attempt', async () => {
  post.mockResolvedValue(checkout)
  await createTip('creator', input)
  const original = post.mock.calls[0][2]
  post.mockResolvedValueOnce({ status: 'PENDING' })
  await verifyTip('creator', checkout.reference)
  post.mockResolvedValueOnce({ status: 'SUCCEEDED' })
  await verifyTip('creator', 'unrelated')
  await createTip('creator', input)
  expect(post.mock.calls[3][2]).toEqual(original)
  post.mockResolvedValueOnce({ status: 'SUCCEEDED' })
  await verifyTip('creator', checkout.reference)
  await createTip('creator', input)
  expect(post.mock.calls[5][2]).not.toEqual(original)
})
it.each(['ios', 'android'])('does not initialize checkout or save an attempt on %s', async os => {
  platform.OS = os
  await expect(createTip('creator', input)).rejects.toThrow('not available')
  expect(post).not.toHaveBeenCalled()
  expect(data.size).toBe(0)
})
it('preserves a confirmed outcome if local attempt cleanup fails', async () => {
  const storage = (await import('@react-native-async-storage/async-storage')).default;
  post.mockResolvedValueOnce(checkout);
  await createTip('creator', input);
  const cleanup = vi.spyOn(storage, 'multiRemove').mockRejectedValueOnce(new Error('storage unavailable'));
  post.mockResolvedValueOnce({ status: 'SUCCEEDED' });
  expect(await verifyTip('creator', checkout.reference)).toEqual({ status: 'SUCCEEDED' });
  expect(data.size).toBeGreaterThan(0);
  cleanup.mockRestore();
});
