import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFeaturedDonors, useLeaderboard } from '@/hooks/useLeaderboard'
import { api } from '@/lib/api'
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
afterEach(() => { auth.user = null; vi.resetAllMocks(); vi.useRealTimers() })
const stats = { totalAmount: 4200, totalDonations: 2, totalDonors: 0 }
describe('leaderboard loading', () => {
  it('shows guest contribution totals even when rankings are empty', async () => {
    vi.mocked(api.get).mockImplementation(async url => url.includes('/stats') ? { data: stats } : { data: [] })
    const { result } = renderHook(() => useLeaderboard())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.stats).toEqual(stats)
    expect(result.current.entries).toEqual([])
    expect(result.current.error).toBeNull()
  })
  it('exposes failures and allows retry', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Unavailable'))
    const { result } = renderHook(() => useLeaderboard())
    await waitFor(() => expect(result.current.error).toBe('Unavailable'))
    vi.mocked(api.get).mockImplementation(async url => url.includes('/stats') ? stats : [])
    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.stats.totalAmount).toBe(4200)
  })
  it('refreshes on focus and every 30 seconds, and cleans up on unmount', async () => {
    vi.useFakeTimers()
    vi.mocked(api.get).mockImplementation(async url => url.includes('/stats') ? stats : [])
    const { unmount } = renderHook(() => useLeaderboard())
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(api.get).toHaveBeenCalledTimes(2)
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(api.get).toHaveBeenCalledTimes(4)
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(api.get).toHaveBeenCalledTimes(6)
    unmount()
    await vi.advanceTimersByTimeAsync(30_000)
    window.dispatchEvent(new Event('focus'))
    expect(api.get).toHaveBeenCalledTimes(6)
  })
})

it('clears rows and totals on viewer changes and ignores an old viewer response', async () => {
  auth.user = { id: 'first' }
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementation(url => url.includes('/stats') ? Promise.resolve(stats) : new Promise(resolve => { finish = resolve }))
  const hook = renderHook(() => useLeaderboard())
  auth.user = { id: 'second' }
  vi.mocked(api.get).mockRejectedValue(new Error('Unavailable to second viewer'))
  hook.rerender()
  expect(hook.result.current.entries).toEqual([])
  expect(hook.result.current.stats.totalAmount).toBe(0)
  await waitFor(() => expect(hook.result.current.error).toBe('Unavailable to second viewer'))
  await act(async () => finish([{ userId: 'hidden', name: 'Old viewer identity' }]))
  expect(hook.result.current.entries).toEqual([])
})
it('refreshes featured names on focus and clears them on logout or denial', async () => {
  auth.user = { id: 'first' }
  vi.mocked(api.get).mockResolvedValue({ topAllTime: [{ userId: 'donor', name: 'Visible donor' }], topThisMonth: [] })
  const hook = renderHook(() => useFeaturedDonors())
  await waitFor(() => expect(hook.result.current.featured.topAllTime).toHaveLength(1))
  vi.mocked(api.get).mockResolvedValue({ topAllTime: [], topThisMonth: [] })
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(hook.result.current.featured.topAllTime).toEqual([]))
  auth.user = null
  vi.mocked(api.get).mockRejectedValue(new Error('Unavailable'))
  hook.rerender()
  expect(hook.result.current.featured.topAllTime).toEqual([])
  await waitFor(() => expect(hook.result.current.error).toBe('Unavailable'))
})
