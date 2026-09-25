import { beforeEach, expect, it, vi } from 'vitest'
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../api', () => ({ api: { get, post } }))
import { loadEmailVerification, requestVerificationLink, shouldPromptVerification } from '../emailVerification'

beforeEach(() => { get.mockReset(); post.mockReset() })

it('prompts only unverified members whose email can actually be delivered', async () => {
  get.mockResolvedValueOnce({ emailVerified: false, deliveryConfigured: true })
  expect(shouldPromptVerification(await loadEmailVerification())).toBe(true)
  get.mockResolvedValueOnce({ emailVerified: true, deliveryConfigured: true })
  expect(shouldPromptVerification(await loadEmailVerification())).toBe(false)
  get.mockResolvedValueOnce({ emailVerified: false, deliveryConfigured: false })
  expect(shouldPromptVerification(await loadEmailVerification())).toBe(false)
  get.mockRejectedValueOnce(new Error('offline'))
  expect(await loadEmailVerification()).toBeNull()
  expect(shouldPromptVerification(null)).toBe(false)
})

it('requests a link and reports an already verified address', async () => {
  post.mockResolvedValueOnce({ emailVerified: false })
  expect(await requestVerificationLink()).toEqual({ verified: false, message: expect.stringContaining('Check your email') })
  expect(post).toHaveBeenCalledWith('/email-verification', {})
  post.mockResolvedValueOnce({ emailVerified: true })
  expect((await requestVerificationLink()).verified).toBe(true)
})
