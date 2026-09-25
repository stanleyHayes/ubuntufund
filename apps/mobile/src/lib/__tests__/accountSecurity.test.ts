import { beforeEach, expect, it, vi } from 'vitest'
const { put } = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('../api', () => ({ api: { put } }))
import { changePassword } from '../accountSecurity'

const input = { currentPassword: 'OldPass12345', newPassword: 'NewPass12345' }
const tokens = { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' }
beforeEach(() => { put.mockReset() })

it('stores the rotated tokens so this device stays signed in', async () => {
  put.mockResolvedValue({ tokens })
  const replaceTokens = vi.fn(async () => {})
  expect(await changePassword(input, 'member', replaceTokens)).toBe('saved')
  expect(put).toHaveBeenCalledWith('/auth/change-password', input)
  expect(replaceTokens).toHaveBeenCalledWith(tokens, 'member')
})

it('reports when the password changed but the new sign-in could not be stored', async () => {
  put.mockResolvedValue({ tokens })
  expect(await changePassword(input, 'member', vi.fn(async () => { throw new Error('keychain locked') }))).toBe('session-not-saved')
  put.mockResolvedValue({})
  const replaceTokens = vi.fn(async () => {})
  expect(await changePassword(input, 'member', replaceTokens)).toBe('session-not-saved')
  expect(replaceTokens).not.toHaveBeenCalled()
})

it('leaves the session alone when the API refuses the change', async () => {
  put.mockRejectedValue(new Error('Current password is incorrect'))
  const replaceTokens = vi.fn(async () => {})
  await expect(changePassword(input, 'member', replaceTokens)).rejects.toThrow('Current password is incorrect')
  expect(replaceTokens).not.toHaveBeenCalled()
})
