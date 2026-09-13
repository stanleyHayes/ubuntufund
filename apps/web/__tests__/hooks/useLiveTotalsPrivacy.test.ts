import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useLiveTotals } from '@/hooks/useLiveTotals'
import { api } from '@/lib/api'
const auth = vi.hoisted(() => ({ user: { id: 'viewer' } as { id: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
let source: EventTarget
class TestSource extends EventTarget {
  constructor() { super(); source = this }
  close() {}
}
beforeEach(() => { vi.stubGlobal('EventSource', TestSource); auth.user = { id: 'viewer' } })
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })
const row = { id: 'donation', donorName: 'Current authorized donor', amount: 10, currency: 'GHS', isAnonymous: false, createdAt: '2026-09-13T00:00:00Z' }
it('never uses the guest SSE name and reloads viewer-authorized donation data', async () => {
  vi.mocked(api.get).mockResolvedValue({ items: [row] })
  const hook = renderHook(() => useLiveTotals('campaign'))
  await waitFor(() => expect(hook.result.current.lastDonation?.name).toBe(row.donorName))
  vi.mocked(api.get).mockResolvedValue({ items: [{ ...row, donorName: 'Anonymous', isAnonymous: true }] })
  act(() => source.dispatchEvent(new MessageEvent('donation', { data: JSON.stringify({ name: 'Blocked guest-event name', amount: 900 }) })))
  await waitFor(() => expect(hook.result.current.lastDonation?.name).toBe('Anonymous'))
  expect(hook.result.current.lastDonation?.amount).toBe(10)
})
it('clears retained identity on a denied focus refresh and when disabled', async () => {
  vi.mocked(api.get).mockResolvedValue({ items: [row] })
  const hook = renderHook(({ enabled }) => useLiveTotals('campaign', { enabled }), { initialProps: { enabled: true } })
  await waitFor(() => expect(hook.result.current.lastDonation).not.toBeNull())
  vi.mocked(api.get).mockRejectedValue(new Error('Access denied'))
  act(() => window.dispatchEvent(new Event('focus')))
  await waitFor(() => expect(hook.result.current.lastDonation).toBeNull())
  hook.rerender({ enabled: false })
  expect(hook.result.current.donations).toEqual([])
})
it('isolates account changes and discards the previous viewer promise', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const hook = renderHook(() => useLiveTotals('campaign'))
  auth.user = null
  vi.mocked(api.get).mockResolvedValue({ items: [] })
  hook.rerender()
  expect(hook.result.current.lastDonation).toBeNull()
  await act(async () => finish({ items: [row] }))
  expect(hook.result.current.lastDonation).toBeNull()
})
