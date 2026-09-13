import { act, renderHook, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { usePublicRead } from '../usePublicRead'
const auth = vi.hoisted(() => ({ user: { id: 'viewer' } as { id: string } | null }))
const lifecycle = vi.hoisted(() => ({ activate: (_state: string) => {} }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('expo-router', () => ({ useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]) }))
vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: (_event: string, callback: (state: string) => void) => { lifecycle.activate = callback; return { remove: () => {} } } } }))
beforeEach(() => { auth.user = { id: 'viewer' } })
it('discards old-viewer responses and clears data immediately on account changes', async () => {
  let finish!: (data: string[]) => void
  const fetchData = vi.fn<() => Promise<string[]>>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const hook = renderHook(() => usePublicRead('organizations', fetchData))
  auth.user = null
  fetchData.mockResolvedValue([])
  hook.rerender()
  expect(hook.result.current.data).toBeNull()
  await waitFor(() => expect(hook.result.current.data).toEqual([]))
  await act(async () => finish(['Old viewer organization']))
  expect(hook.result.current.data).toEqual([])
})
it('removes a visible organization on denied app activation and supports retry', async () => {
  const fetchData = vi.fn<() => Promise<string>>().mockResolvedValue('Visible organization')
  const hook = renderHook(() => usePublicRead('organization:first', fetchData))
  await waitFor(() => expect(hook.result.current.data).toBe('Visible organization'))
  fetchData.mockRejectedValue(new Error('Organization not found'))
  act(() => lifecycle.activate('active'))
  await waitFor(() => expect(hook.result.current.data).toBeNull())
  expect(hook.result.current.error).toBe('Organization not found')
  fetchData.mockResolvedValue('Restored organization')
  act(() => hook.result.current.refresh())
  await waitFor(() => expect(hook.result.current.data).toBe('Restored organization'))
})
it('does not retain a previous target while a new organization is loading', async () => {
  const fetchData = vi.fn<() => Promise<string>>().mockResolvedValue('First')
  const hook = renderHook(({ target }) => usePublicRead(target, fetchData), { initialProps: { target: 'first' } })
  await waitFor(() => expect(hook.result.current.data).toBe('First'))
  fetchData.mockRejectedValue(new Error('Hidden'))
  hook.rerender({ target: 'second' })
  expect(hook.result.current.data).toBeNull()
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
})
