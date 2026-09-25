import { renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useAdminCampaigns } from '@/hooks/useApiData'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

it('loads every campaign page so an old pending campaign reaches the Pending tab', async () => {
  const campaigns = Array.from({ length: 130 }, (_, index) => ({ id: `c${index}`, title: `Campaign ${index}`, status: index === 129 ? 'pending_review' : 'active' }))
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    const url = new URL(path, 'https://admin.test')
    const page = Number(url.searchParams.get('page')), pageSize = Number(url.searchParams.get('pageSize'))
    return { items: campaigns.slice((page - 1) * pageSize, page * pageSize), total: campaigns.length, page, pageSize, totalPages: Math.ceil(campaigns.length / pageSize) }
  })
  const { result } = renderHook(() => useAdminCampaigns())
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.error).toBeNull()
  expect(result.current.data).toHaveLength(130)
  expect(result.current.data.filter(campaign => campaign.status === 'pending_review').map(campaign => campaign.id)).toEqual(['c129'])
  expect(vi.mocked(api.get).mock.calls.map(([path]) => path)).toEqual(['/campaigns?pageSize=100&page=1', '/campaigns?pageSize=100&page=2'])
})
