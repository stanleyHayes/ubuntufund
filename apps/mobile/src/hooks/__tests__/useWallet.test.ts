import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
const m = vi.hoisted(() => ({ focus: null as null | (() => void | (() => void)), change: null as null | ((state: string) => void) }))
vi.mock('react-native', () => ({ AppState: { addEventListener: (_event: string, callback: (state: string) => void) => { m.change = callback; return { remove: () => { m.change = null } } } } }))
vi.mock('expo-router', async () => {
  const React = await import('react')
  return { useFocusEffect: (callback: () => void | (() => void)) => { React.useEffect(() => { m.focus = callback; return callback() || undefined }, [callback]) } }
})
import { useWallet } from '../useWallet'
const wallet = (balance: number) => ({ id: 'w1', userId: 'u1', type: 'local', currency: 'GHS', balance })
let balance = 100
beforeEach(() => {
  balance = 100
  vi.mocked(api.get).mockReset().mockImplementation(async (path: string) => path === '/wallets' ? [wallet(balance)] : [] as never)
})
const walletCalls = () => vi.mocked(api.get).mock.calls.filter(([path]) => path === '/wallets').length

it('reloads the balance when the tab regains focus and when the app returns from Safari', async () => {
  const { result } = renderHook(() => useWallet('u1'))
  await waitFor(() => expect(result.current.wallets[0]?.balance).toBe(100))
  expect(walletCalls()).toBe(1)
  balance = 150
  act(() => { m.focus?.() })
  await waitFor(() => expect(result.current.wallets[0]?.balance).toBe(150))
  expect(walletCalls()).toBe(2)
  balance = 175
  act(() => m.change?.('active'))
  await waitFor(() => expect(result.current.wallets[0]?.balance).toBe(175))
  expect(walletCalls()).toBe(3)
  act(() => m.change?.('background'))
  expect(walletCalls()).toBe(3)
})

it('keeps loaded data on a failed reload and clears the error when a later reload succeeds', async () => {
  const { result } = renderHook(() => useWallet('u1'))
  await waitFor(() => expect(result.current.loaded).toBe(true))
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Ujimora took too long to respond.'))
  act(() => result.current.refresh())
  await waitFor(() => expect(result.current.error).toBe('Ujimora took too long to respond.'))
  expect(result.current.wallets[0]?.balance).toBe(100)
  expect(result.current.refreshing).toBe(false)
  balance = 90
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.error).toBeNull())
  expect(result.current.wallets[0]?.balance).toBe(90)
})

it('does not load without a signed-in user', () => {
  renderHook(() => useWallet(undefined))
  expect(api.get).not.toHaveBeenCalled()
})

it("never shows the previous account's wallet to the next user, even when their load fails", async () => {
  const { result, rerender } = renderHook(({ userId }: { userId: string | undefined }) => useWallet(userId), { initialProps: { userId: 'u1' as string | undefined } })
  await waitFor(() => expect(result.current.wallets[0]?.balance).toBe(100))
  // The session ends without navigation (idle expiry or refresh 401): nothing of u1 stays in the hook.
  rerender({ userId: undefined })
  expect(result.current).toMatchObject({ wallets: [], transactions: [], loaded: false, error: null })
  // Another account signs in on the same, still-mounted Wallet tab and its first load fails.
  let fail!: (error: Error) => void
  vi.mocked(api.get).mockImplementation(() => new Promise((_resolve, reject) => { fail = reject }))
  rerender({ userId: 'u2' })
  expect(result.current).toMatchObject({ wallets: [], transactions: [], loaded: false, isLoading: true })
  await act(async () => fail(new Error('Could not reach Ujimora.')))
  expect(result.current).toMatchObject({ wallets: [], transactions: [], loaded: false, isLoading: false, error: 'Could not reach Ujimora.' })
})

it("drops a late response for the previous user after the account changes", async () => {
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementation(async (path: string) => path === '/wallets' ? new Promise(resolve => { finish = resolve }) as never : [] as never)
  const { result, rerender } = renderHook(({ userId }: { userId: string }) => useWallet(userId), { initialProps: { userId: 'u1' } })
  const finishU1 = finish
  vi.mocked(api.get).mockImplementation(async (path: string) => path === '/wallets' ? [{ ...wallet(20), userId: 'u2' }] : [] as never)
  rerender({ userId: 'u2' })
  await waitFor(() => expect(result.current.wallets[0]?.balance).toBe(20))
  await act(async () => finishU1([wallet(999)]))
  expect(result.current.wallets[0]?.balance).toBe(20)
})
