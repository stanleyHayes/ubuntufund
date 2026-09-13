import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useCampaign, useCampaigns } from '@/hooks/useCampaigns'
import { api } from '@/lib/api'
const auth = vi.hoisted(() => ({ user: { id: 'owner', role: 'user' } as { id: string; role: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'owner', role: 'user' } })
it('clears a private detail immediately on logout and ignores an old owner response', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const result = renderHook(() => useCampaign('campaign'))
  auth.user = null
  vi.mocked(api.get).mockResolvedValue(null)
  result.rerender()
  expect(result.result.current.campaign).toBeNull()
  await waitFor(() => expect(result.result.current.isLoading).toBe(false))
  await act(async () => finish({ id: 'campaign', title: 'Private owner draft' }))
  expect(result.result.current.campaign).toBeNull()
})
it('removes an administrator list immediately after the viewer changes, even if the new read fails', async () => {
  auth.user = { id: 'staff', role: 'admin' }
  vi.mocked(api.get).mockResolvedValue({ items: [{ id: 'draft', title: 'Private campaign' }] })
  const result = renderHook(() => useCampaigns())
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(1))
  auth.user = { id: 'reader', role: 'user' }
  vi.mocked(api.get).mockRejectedValue(new Error('Connection failed'))
  result.rerender()
  expect(result.result.current.campaigns).toEqual([])
  await waitFor(() => expect(result.result.current.error).toBe('Connection failed'))
  expect(result.result.current.campaigns).toEqual([])
})
