import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, it, expect, vi } from 'vitest'
import { usePublicCampaign } from '@/hooks/usePublicCampaign'
import { getCampaignBySlug } from '@/lib/fundraising'
vi.mock('@/lib/fundraising', () => ({ getCampaignBySlug: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
it('drops published content immediately on focus refresh and keeps it removed after a 404', async () => {
  vi.mocked(getCampaignBySlug).mockResolvedValue({ title: 'Previously public story' } as never)
  const hook = renderHook(() => usePublicCampaign('campaign'))
  await waitFor(() => expect(hook.result.current.campaign?.title).toBe('Previously public story'))
  vi.mocked(getCampaignBySlug).mockRejectedValue(new Error('Campaign not found'))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(hook.result.current.campaign).toBeNull()
  await waitFor(() => expect(hook.result.current.notFound).toBe(true))
  expect(hook.result.current.campaign).toBeNull()
})
it('never displays a previous slug while a different share link is loading', async () => {
  vi.mocked(getCampaignBySlug).mockResolvedValue({ title: 'Previous campaign' } as never)
  const hook = renderHook(({ slug }) => usePublicCampaign(slug), { initialProps: { slug: 'first' } })
  await waitFor(() => expect(hook.result.current.campaign?.title).toBe('Previous campaign'))
  vi.mocked(getCampaignBySlug).mockImplementation(() => new Promise(() => {}))
  hook.rerender({ slug: 'second' })
  expect(hook.result.current.campaign).toBeNull()
  expect(hook.result.current.isLoading).toBe(true)
})
