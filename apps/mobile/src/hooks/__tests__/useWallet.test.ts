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
