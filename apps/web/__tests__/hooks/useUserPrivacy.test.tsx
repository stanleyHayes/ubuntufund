import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useUser } from '@/hooks/useUser'
import { api } from '@/lib/api'
const auth = vi.hoisted(() => ({ user: { id: 'viewer' } as { id: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks(); auth.user = { id: 'viewer' } })
it('clears the old profile immediately when switching the target, including an empty target', async () => {
  vi.mocked(api.get).mockResolvedValue({ id: 'first', name: 'First' })
  const hook = renderHook(({ id }) => useUser(id), { initialProps: { id: 'first' } })
  await waitFor(() => expect(hook.result.current.user?.id).toBe('first'))
  vi.mocked(api.get).mockRejectedValue(new Error('Blocked'))
  hook.rerender({ id: 'second' })
  expect(hook.result.current.user).toBeNull()
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  hook.rerender({ id: '' })
  expect(hook.result.current).toEqual({ user: null, isLoading: false })
})
it('isolates viewers and ignores an old viewer response after logout', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const hook = renderHook(() => useUser('target'))
  auth.user = null
  vi.mocked(api.get).mockRejectedValue(new Error('Private'))
  hook.rerender()
  expect(hook.result.current.user).toBeNull()
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false))
  await act(async () => finish({ id: 'target', name: 'Old viewer response' }))
  expect(hook.result.current.user).toBeNull()
})
it('removes a previously visible identity when focus refresh is denied', async () => {
  vi.mocked(api.get).mockResolvedValue({ id: 'target', name: 'Visible identity' })
  const hook = renderHook(() => useUser('target'))
  await waitFor(() => expect(hook.result.current.user?.id).toBe('target'))
  vi.mocked(api.get).mockRejectedValue(new Error('Blocked after initial read'))
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(hook.result.current.user).toBeNull())
})
