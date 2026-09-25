import { act, renderHook, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { CampaignCategory, CampaignStatus } from '@ubuntu-fund/types'
import { campaignSearchPath, useCampaignSearch, type CampaignSearchParams } from '../useCampaigns'
import { exploreSearchParams } from '@/lib/exploreSearch'
import { api } from '@/lib/api'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('expo-router', () => ({ useFocusEffect: (callback: () => void | (() => void)) => useEffect(callback, [callback]) }))
vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) } }))

const row = (id: string) => ({ id, title: `Campaign ${id}` })
beforeEach(() => { vi.resetAllMocks() })

it('builds server queries for search, filters and sort', () => {
  expect(campaignSearchPath({ q: ' clinic ', category: CampaignCategory.MEDICAL, status: CampaignStatus.EXPIRED, sortBy: 'fundedPercent', sortOrder: 'desc' }, 2))
    .toBe('/campaigns?page=2&pageSize=20&q=clinic&category=medical&status=expired&sortBy=fundedPercent&sortOrder=desc')
  expect(campaignSearchPath({}, 1)).toBe('/campaigns?page=1&pageSize=20')
})

it('never sorts ended campaigns to the top of "ending soon"', () => {
  expect(exploreSearchParams('', null, null, 'ending_soon')).toMatchObject({ status: 'open', sortBy: 'endDate', sortOrder: 'asc' })
  expect(exploreSearchParams('', null, CampaignStatus.FUNDED, 'ending_soon')).toMatchObject({ status: CampaignStatus.FUNDED })
  expect(exploreSearchParams('', null, null, 'most_funded')).toMatchObject({ status: null, sortBy: 'fundedPercent', sortOrder: 'desc' })
  expect(exploreSearchParams('', null, null, 'newest')).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc' })
})

it('loads further pages from the server and appends them without duplicates', async () => {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    const page = Number(new URL(path, 'https://app.test').searchParams.get('page'))
    return page === 1
      ? { items: [row('a'), row('b')], total: 3, totalPages: 2 }
      : { items: [row('b'), row('c')], total: 3, totalPages: 2 }
  })
  const params: CampaignSearchParams = { q: 'Campaign', pageSize: 2 }
  const result = renderHook(() => useCampaignSearch(params))
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(2))
  expect(result.result.current).toMatchObject({ total: 3, hasMore: true, isLoading: false })
  act(() => result.result.current.loadMore())
  await waitFor(() => expect(result.result.current.campaigns.map(item => item.id)).toEqual(['a', 'b', 'c']))
  expect(result.result.current.hasMore).toBe(false)
  expect(vi.mocked(api.get).mock.calls.map(([path]) => path)).toEqual([
    '/campaigns?page=1&pageSize=2&q=Campaign',
    '/campaigns?page=2&pageSize=2&q=Campaign',
  ])
})

it('starts again from page one when the search changes and drops the stale list', async () => {
  vi.mocked(api.get).mockResolvedValue({ items: [row('a')], total: 1, totalPages: 1 })
  let params: CampaignSearchParams = { q: 'first' }
  const result = renderHook(() => useCampaignSearch(params))
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(1))
  let finish!: (value: unknown) => void
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  params = { q: 'second' }
  result.rerender()
  expect(result.result.current.campaigns).toEqual([])
  expect(result.result.current.isLoading).toBe(true)
  await act(async () => finish({ items: [row('z')], total: 1, totalPages: 1 }))
  expect(result.result.current.campaigns.map(item => item.id)).toEqual(['z'])
  expect(String(vi.mocked(api.get).mock.calls.at(-1)?.[0])).toContain('q=second')
})
