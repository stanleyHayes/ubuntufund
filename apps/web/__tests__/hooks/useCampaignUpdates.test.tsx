import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useCampaignUpdates } from '@/hooks/useCampaignUpdates'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

it('removes owner-only updates immediately when the viewer changes', async () => {
  let finishGuest!: (data: unknown) => void
  vi.mocked(api.get).mockReset().mockResolvedValueOnce({ items: [{ id: 'private-update' }] }).mockImplementationOnce(() => new Promise(resolve => { finishGuest = resolve }) as never)
  const { result, rerender } = renderHook(({ viewer }) => useCampaignUpdates('campaign', viewer), { initialProps: { viewer: 'owner' as string | undefined } })
  await waitFor(() => expect(result.current.updates).toHaveLength(1))
  rerender({ viewer: undefined })
  expect(result.current.updates).toEqual([])
  expect(result.current.isLoading).toBe(true)
  await act(async () => finishGuest({ items: [] }))
  expect(result.current.updates).toEqual([])
})

it('ignores an old viewer response arriving after the new viewer response', async () => {
  let finishOwner!: (data: unknown) => void
  vi.mocked(api.get).mockReset().mockImplementationOnce(() => new Promise(resolve => { finishOwner = resolve }) as never).mockResolvedValueOnce({ items: [{ id: 'public-update' }] })
  const { result, rerender } = renderHook(({ viewer }) => useCampaignUpdates('campaign', viewer), { initialProps: { viewer: 'owner' as string | undefined } })
  rerender({ viewer: undefined })
  await waitFor(() => expect(result.current.updates[0]?.id).toBe('public-update'))
  await act(async () => finishOwner({ items: [{ id: 'private-update' }] }))
  expect(result.current.updates.map(item => item.id)).toEqual(['public-update'])
})
