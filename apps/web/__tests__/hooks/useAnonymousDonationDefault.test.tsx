import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAnonymousDonationDefault } from '@/hooks/useAnonymousDonationDefault'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
beforeEach(() => vi.mocked(api.get).mockReset())

// I081: the saved setting must pre-select "Give anonymously" on donation forms.
describe('anonymous-by-default donation setting', () => {
  it('reads the signed-in donor setting', async () => {
    vi.mocked(api.get).mockResolvedValue({ anonymousDonations: true })
    const { result } = renderHook(() => useAnonymousDonationDefault('user-1'))
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBe(true))
    expect(api.get).toHaveBeenCalledWith('/profile')
  })
  it('is off when the setting is off', async () => {
    vi.mocked(api.get).mockResolvedValue({ anonymousDonations: false })
    const { result } = renderHook(() => useAnonymousDonationDefault('user-2'))
    await waitFor(() => expect(result.current).toBe(false))
  })
  it('stays unknown for guests and when the profile cannot be read', async () => {
    const guest = renderHook(() => useAnonymousDonationDefault(undefined))
    expect(guest.result.current).toBeUndefined()
    expect(api.get).not.toHaveBeenCalled()
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'))
    const failed = renderHook(() => useAnonymousDonationDefault('user-3'))
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(failed.result.current).toBeUndefined()
  })
  it('never applies one account setting to another', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ anonymousDonations: true })
    const { result, rerender } = renderHook(({ id }: { id?: string }) => useAnonymousDonationDefault(id), { initialProps: { id: 'user-a' } })
    await waitFor(() => expect(result.current).toBe(true))
    let finish!: (value: unknown) => void
    vi.mocked(api.get).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    rerender({ id: 'user-b' })
    expect(result.current).toBeUndefined()
    finish({ anonymousDonations: false })
    await waitFor(() => expect(result.current).toBe(false))
  })
})
