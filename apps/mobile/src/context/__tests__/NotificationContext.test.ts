import { createElement, useEffect } from 'react'
import { act, render, waitFor, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NotificationProvider, useNotifications } from '../NotificationContext'
import { api } from '@/lib/api'
const state = vi.hoisted(() => ({
  user: { id: 'owner' } as { id: string } | null,
  onState: (_s: string) => {},
  remove: vi.fn(),
}))
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, callback: (s: string) => void) => {
      state.onState = callback
      return { remove: state.remove }
    },
  },
}))
// A ref-shaped box rather than a bare `let`: react-hooks' compiler rules reject
// reassigning a variable declared outside the component, and a `*Ref` holder is
// the escape hatch the rule itself points at.
const probeRef: { current: ReturnType<typeof useNotifications> } = {
  current: null as unknown as ReturnType<typeof useNotifications>,
}
function Probe() {
  const value = useNotifications()
  // Published from an effect, not written during render: the react-hooks
  // compiler rules forbid a render-phase write to a module-scope binding, and
  // point at an effect as the supported way to surface a value to a test.
  useEffect(() => {
    probeRef.current = value
  })
  return null
}
const tree = () => createElement(NotificationProvider, null, createElement(Probe))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  state.user = { id: 'owner' }
})
it('shares unread state, marks read, refreshes on foreground, and removes listeners', async () => {
  vi.mocked(api.get).mockResolvedValue([
    { id: 'n1', title: 'Paid', message: 'Completed', read: false },
  ])
  vi.mocked(api.put).mockResolvedValue({})
  const view = render(tree())
  await waitFor(() => expect(probeRef.current.loading).toBe(false))
  expect(probeRef.current.items.filter((n) => !n.read)).toHaveLength(1)
  await act(async () => probeRef.current.markRead('n1'))
  expect(probeRef.current.items[0].read).toBe(true)
  await act(async () => state.onState('active'))
  expect(api.get).toHaveBeenCalledTimes(2)
  view.unmount()
  expect(state.remove).toHaveBeenCalled()
})
it('does not expose a previous user’s late response after logout', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(api.get).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  const view = render(tree())
  state.user = null
  view.rerender(tree())
  await act(async () => resolve([{ id: 'old', read: false }]))
  expect(probeRef.current.items).toEqual([])
  expect(probeRef.current.loading).toBe(false)
})
