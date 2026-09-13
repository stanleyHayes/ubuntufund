import { beforeEach, expect, it, vi } from 'vitest'
const { platform, post } = vi.hoisted(() => ({ platform: { OS: 'ios' }, post: vi.fn() }))
vi.mock('react-native', () => ({ Platform: platform }))
vi.mock('../payments', () => ({ paymentScope: () => 'creator', paymentKey: async () => 'test-attempt', savePending: vi.fn(), loadPending: vi.fn(), clearPending: vi.fn() }))
vi.mock('../api', () => ({ api: { post } }))
import { createTip } from '../creators'
beforeEach(() => post.mockReset())

it.each(['ios', 'android'])('does not initiate external creator checkout on %s', async os => {
  platform.OS = os
  await expect(createTip('ama', { amount: 25, supporterEmail: 'donor@example.test' })).rejects.toThrow('not available')
  expect(post).not.toHaveBeenCalled()
})

it('retains the web creator checkout', async () => {
  platform.OS = 'web'
  post.mockResolvedValue({ checkoutUrl: 'https://checkout.test', reference: 'tip-fixture', tipId: 'tip-id' })
  await createTip('ama', { amount: 25, supporterEmail: 'donor@example.test' })
  expect(post).toHaveBeenCalledWith('/creators/ama/tips', { amount: 25, supporterEmail: 'donor@example.test' }, { 'Idempotency-Key': 'test-attempt' })
})
