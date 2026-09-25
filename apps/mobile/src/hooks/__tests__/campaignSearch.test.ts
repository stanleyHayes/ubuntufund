import { act, renderHook, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { CampaignCategory, CampaignStatus } from '@ubuntu-fund/types'
import { campaignSearchPath, useCampaignSearch, type CampaignSearchParams } from '../useCampaigns'
import { exploreSearchParams } from '@/lib/exploreSearch'
import { api } from '@/lib/api'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
const m = vi.hoisted(() => ({ focus: null as null | (() => void | (() => void)) }))
// Like expo-router: runs the callback while focused and again whenever it changes; m.focus() simulates a later refocus.
vi.mock('expo-router', () => ({ useFocusEffect: (callback: () => void | (() => void)) => { m.focus = callback; useEffect(callback, [callback]) } }))
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

const pages = (path: string) => {
  const page = Number(new URL(path, 'https://app.test').searchParams.get('page'))
  return { items: [row(`p${page}a`), row(`p${page}b`)], total: 6, totalPages: 3 }
}

it('keeps every loaded page when Explore regains focus (back from a campaign)', async () => {
  vi.mocked(api.get).mockImplementation(async (path: string) => pages(path))
  const result = renderHook(() => useCampaignSearch({ pageSize: 2 }))
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(2))
  act(() => result.result.current.loadMore())
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(4))
  act(() => result.result.current.loadMore())
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(6))
  act(() => { m.focus?.() })
  await act(async () => {})
  expect(result.result.current.campaigns.map(item => item.id)).toEqual(['p1a', 'p1b', 'p2a', 'p2b', 'p3a', 'p3b'])
  expect(vi.mocked(api.get)).toHaveBeenCalledTimes(3)
})

it('keeps the list and reports the error when a refresh or "Load more" fails', async () => {
  vi.mocked(api.get).mockImplementation(async (path: string) => pages(path))
  const result = renderHook(() => useCampaignSearch({ pageSize: 2 }))
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(2))
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Ujimora took too long to respond.'))
  act(() => result.result.current.loadMore())
  await waitFor(() => expect(result.result.current.loadMoreError).toBe('Ujimora took too long to respond.'))
  expect(result.result.current).toMatchObject({ hasMore: true, isLoadingMore: false, error: null })
  expect(result.result.current.campaigns).toHaveLength(2)
  act(() => result.result.current.loadMore())
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(4))
  expect(result.result.current.loadMoreError).toBeNull()
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Could not reach Ujimora.'))
  act(() => result.result.current.refetch())
  await waitFor(() => expect(result.result.current.error).toBe('Could not reach Ujimora.'))
  expect(result.result.current).toMatchObject({ isRefreshing: false, isLoading: false })
  expect(result.result.current.campaigns).toHaveLength(4)
  // A successful pull-to-refresh starts again from fresh page one data.
  act(() => result.result.current.refetch())
  await waitFor(() => expect(result.result.current.error).toBeNull())
  expect(result.result.current.campaigns.map(item => item.id)).toEqual(['p1a', 'p1b'])
})

it('shows a failed first load as an error (not "no campaigns") and retries it on focus or retry', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Could not reach Ujimora.'))
  const result = renderHook(() => useCampaignSearch({ pageSize: 2 }))
  await waitFor(() => expect(result.result.current.error).toBe('Could not reach Ujimora.'))
  expect(result.result.current).toMatchObject({ campaigns: [], isLoading: false })
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Still offline.'))
  act(() => { m.focus?.() })
  await waitFor(() => expect(result.result.current.error).toBe('Still offline.'))
  vi.mocked(api.get).mockImplementation(async (path: string) => pages(path))
  act(() => result.result.current.refetch())
  await waitFor(() => expect(result.result.current.campaigns).toHaveLength(2))
  expect(result.result.current).toMatchObject({ error: null, hasMore: true })
})
