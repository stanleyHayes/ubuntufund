import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
afterEach(() => { vi.resetAllMocks(); vi.useRealTimers() })
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
