import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { usePlanMap } from '@/hooks/useSubscription'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
afterEach(() => { vi.mocked(api.get).mockReset() })

const starter = { tier: 'starter', name: 'Starter', priceMonthly: 9.99, priceYearly: 99 }

describe('the plans page plan map', () => {
  it('starts empty and not loaded, then holds only the live plans', async () => {
    vi.mocked(api.get).mockResolvedValue([starter])
    const { result } = renderHook(() => usePlanMap())
    // No seeded commercial defaults while the request is in flight.
    expect(result.current.plans).toEqual({})
    expect(result.current.loaded).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.plans).toEqual({ starter })
    expect(result.current.error).toBe(false)
    expect(api.get).toHaveBeenCalledWith('/plans')
  })

  it('reports a failure with no fallback prices, and loads on retry', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([starter])
    const { result } = renderHook(() => usePlanMap())
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.plans).toEqual({})
    expect(result.current.loaded).toBe(false)
    act(() => result.current.retry())
    expect(result.current.error).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.plans.starter.priceMonthly).toBe(9.99)
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('treats an empty or malformed response as a failure', async () => {
    vi.mocked(api.get).mockResolvedValue([])
    const { result } = renderHook(() => usePlanMap())
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.loaded).toBe(false)
  })

  it('asks for nothing while disabled, and loads once enabled', async () => {
    vi.mocked(api.get).mockResolvedValue([starter])
    const { result, rerender } = renderHook(({ enabled }) => usePlanMap({ enabled }), { initialProps: { enabled: false } })
    await act(async () => {})
    expect(api.get).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({ plans: {}, loaded: false, error: false })
    rerender({ enabled: true })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.plans).toEqual({ starter })
    expect(api.get).toHaveBeenCalledTimes(1)
  })
})
