import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePublicFeed } from '@/hooks/usePublicFeed'
import { api } from '@/lib/api'
const auth = vi.hoisted(() => ({ user: { id: 'viewer' } as { id: string } | null }))
const stream = vi.hoisted(() => ({ receive: (_event: string, _payload?: unknown) => {} }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
vi.mock('@/hooks/useSSE', () => ({ useSSE: (_channel: string, options: { onMessage: (event: string, payload?: unknown) => void }) => { stream.receive = options.onMessage } }))
afterEach(() => { vi.resetAllMocks(); vi.useRealTimers(); auth.user = { id: 'viewer' } })
it('uses live events only to refresh current authorized rows, never to restore payload identity', async () => {
  vi.mocked(api.get).mockResolvedValue([{ donorName: 'Visible donor' }])
  const hook = renderHook(() => usePublicFeed<Array<{ donorName: string }>>('/donations', 'global', 'activity'))
  await waitFor(() => expect(hook.result.current.data?.[0].donorName).toBe('Visible donor'))
  vi.useFakeTimers()
  vi.mocked(api.get).mockResolvedValue([{ donorName: 'Anonymous' }])
  act(() => stream.receive('activity', { donorName: 'Stale restricted name' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(300) })
  expect(hook.result.current.data).toEqual([{ donorName: 'Anonymous' }])
})
it('clears cached identities when a focus refresh fails', async () => {
  vi.mocked(api.get).mockResolvedValue([{ donorName: 'Visible donor' }])
  const hook = renderHook(() => usePublicFeed('/donations', 'global', 'activity'))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  vi.mocked(api.get).mockRejectedValue(new Error('Unavailable'))
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(hook.result.current.data).toBeNull())
  expect(hook.result.current.error).toBe('Unavailable')
})
it('isolates viewers and ignores a late result from the previous viewer', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const hook = renderHook(() => usePublicFeed('/donations', 'global', 'activity'))
  auth.user = null
  vi.mocked(api.get).mockResolvedValue([])
  hook.rerender()
  expect(hook.result.current.data).toBeNull()
  await waitFor(() => expect(hook.result.current.data).toEqual([]))
  await act(async () => finish([{ donorName: 'Old viewer identity' }]))
  expect(hook.result.current.data).toEqual([])
})
