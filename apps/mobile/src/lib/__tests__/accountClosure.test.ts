import { beforeEach, expect, it, vi } from 'vitest'
const { get, del } = vi.hoisted(() => ({ get: vi.fn(), del: vi.fn() }))
vi.mock('../api', () => ({ api: { get, delete: del } }))
import { deleteAccount, loadAccountClosureCheck, loadMfaEnabled, openCampaignsWarning } from '../accountClosure'

beforeEach(() => { get.mockReset(); del.mockReset().mockResolvedValue(null) })

it('sends the password, and a trimmed code only when one was entered', async () => {
  await deleteAccount('SecurePass123')
  expect(del).toHaveBeenLastCalledWith('/profile', { password: 'SecurePass123' })
  await deleteAccount('SecurePass123', '  ')
  expect(del).toHaveBeenLastCalledWith('/profile', { password: 'SecurePass123' })
  await deleteAccount('SecurePass123', ' 123456 ')
  expect(del).toHaveBeenLastCalledWith('/profile', { password: 'SecurePass123', code: '123456' })
})

it('surfaces the API refusal so the screen can show the reason', async () => {
  del.mockRejectedValueOnce(Object.assign(new Error('Your account can’t be closed yet. First withdraw or resolve: GHS 150.00 in your Ujimora wallet.'), { status: 409 }))
  await expect(deleteAccount('SecurePass123')).rejects.toThrow('GHS 150.00 in your Ujimora wallet')
})

it('reads the closure preview and MFA status, falling back when unavailable', async () => {
  const check = { canClose: false, openCampaigns: 0, message: 'Withdraw first', blockers: [{ kind: 'wallet_balance', currency: 'GHS', amount: 5 }] }
  get.mockImplementation(async (path: string) => path === '/auth/mfa' ? { enabled: true } : check)
  expect(await loadAccountClosureCheck()).toEqual(check)
  expect(get).toHaveBeenCalledWith('/profile/closure-check')
  expect(await loadMfaEnabled()).toBe(true)
  get.mockRejectedValue(new Error('offline'))
  expect(await loadAccountClosureCheck()).toBeNull()
  expect(await loadMfaEnabled()).toBe(false)
  get.mockResolvedValue({ unexpected: true })
  expect(await loadAccountClosureCheck()).toBeNull()
})

it('warns that open campaigns will end', () => {
  expect(openCampaignsWarning(null)).toBeNull()
  expect(openCampaignsWarning({ canClose: true, openCampaigns: 0, blockers: [] })).toBeNull()
  expect(openCampaignsWarning({ canClose: true, openCampaigns: 1, blockers: [] })).toMatch(/ends your open campaign\. It stops/)
  expect(openCampaignsWarning({ canClose: true, openCampaigns: 3, blockers: [] })).toMatch(/ends your 3 open campaigns\. They stop/)
})
