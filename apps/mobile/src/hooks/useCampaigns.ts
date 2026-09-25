import { useAuth } from '@/context/AuthContext'
import { useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { AppState } from 'react-native'
import { api } from '@/lib/api'
import type { Campaign, CampaignCategory, CampaignDetail, CampaignStatus } from '@ubuntu-fund/types'
import type { User } from '@ubuntu-fund/types'

interface UseCampaignsResult {
  refetch: () => void
  campaigns: Campaign[]
  isLoading: boolean
  error: string | null
}

interface UseCampaignResult {
  campaign: CampaignDetail | null
  donationError: string | null
  isLoading: boolean
  error: string | null
}

interface UseUserResult {
  user: User | null
  isLoading: boolean
}

export function useCampaigns(): UseCampaignsResult {
  const { user } = useAuth()
  const [retry, setRetry] = useState(0)
  const scope = `${user?.id ?? 'guest'}:${user?.role ?? 'guest'}:${retry}`
  const [loadedScope, setLoadedScope] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refetch = useCallback(() => { setIsLoading(true); setError(null); setRetry(value => value + 1) }, [])

  useFocusEffect(useCallback(() => {
    setIsLoading(true)
    let cancelled = false
    api
      .get<Campaign[] | { items: Campaign[] }>('/campaigns')
      .then((data) => {
        if (!cancelled) {
          setCampaigns(Array.isArray(data) ? data : data.items ?? [])
        }
      })
      .catch((err) => {
        if (!cancelled) { setCampaigns([]); setError(err.message) }
      })
      .finally(() => {
        if (!cancelled) { setLoadedScope(scope); setIsLoading(false) }
      })
    return () => {
      cancelled = true
    }
  }, [scope]))

  return { campaigns: loadedScope === scope ? campaigns : [], isLoading: isLoading || loadedScope !== scope, error: loadedScope === scope ? error : null, refetch }
}

/**
 * Server-side discovery query. The API filters by *effective* status (an
 * ACTIVE campaign past its end date is EXPIRED; `open` is ACTIVE or FUNDED and
 * not ended), searches titles and pages, so every public campaign is reachable.
 */
export interface CampaignSearchParams {
  q?: string
  category?: CampaignCategory | null
  status?: CampaignStatus | 'open' | null
  sortBy?: 'createdAt' | 'raisedAmount' | 'endDate' | 'fundedPercent'
  sortOrder?: 'asc' | 'desc'
  pageSize?: number
}

export const CAMPAIGN_SEARCH_PAGE_SIZE = 20

/** Everything but the page number, so every page of one search shares it. */
function campaignSearchQuery(params: CampaignSearchParams): string {
  const query = new URLSearchParams({ pageSize: String(params.pageSize ?? CAMPAIGN_SEARCH_PAGE_SIZE) })
  const q = params.q?.trim().slice(0, 100)
  if (q) query.set('q', q)
  if (params.category) query.set('category', params.category)
  if (params.status) query.set('status', params.status)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  return query.toString()
}

export function campaignSearchPath(params: CampaignSearchParams, page: number): string {
  return `/campaigns?page=${page}&${campaignSearchQuery(params)}`
}

interface CampaignPageResponse { items?: Campaign[]; total?: number; totalPages?: number }
interface CampaignSearchState { scope: string; campaigns: Campaign[]; page: number; total: number; totalPages: number; error: string | null; moreError: string | null }

const firstPage = (scope: string, data: CampaignPageResponse): CampaignSearchState =>
  ({ scope, campaigns: data.items ?? [], page: 1, total: data.total ?? 0, totalPages: data.totalPages ?? 0, error: null, moreError: null })

interface UseCampaignSearchResult {
  campaigns: Campaign[]
  total: number
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  /** A pull-to-refresh or retry of page one is in flight; the current list stays. */
  isRefreshing: boolean
  /** Loading or refreshing page one failed. Any list already shown is kept. */
  error: string | null
  /** The last "Load more" failed; the pages already shown are kept. */
  loadMoreError: string | null
  loadMore: () => void
  /** Reload page one of the current search, keeping the list until it arrives. */
  refetch: () => void
}

export function useCampaignSearch(params: CampaignSearchParams): UseCampaignSearchResult {
  const { user } = useAuth()
  const query = campaignSearchQuery(params)
  const scope = `${user?.id ?? 'guest'}:${user?.role ?? 'guest'}:${query}`
  const [state, setState] = useState<CampaignSearchState>({ scope: '', campaigns: [], page: 0, total: 0, totalPages: 0, error: null, moreError: null })
  const [loadingMore, setLoadingMore] = useState('')
  const [refreshing, setRefreshing] = useState('')
  const current = state.scope === scope
  const loaded = current && state.page > 0

  useFocusEffect(useCallback(() => {
    // Coming back to Explore (e.g. from a campaign) keeps every page already
    // loaded, and so the scroll position. Only a new search, filter or account
    // loads page one here; a load that failed is retried on the next focus.
    if (loaded) return
    let cancelled = false
    api
      .get<CampaignPageResponse>(`/campaigns?page=1&${query}`)
      .then((data) => {
        if (!cancelled) setState(firstPage(scope, data))
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ scope, campaigns: [], page: 0, total: 0, totalPages: 0, error: err.message, moreError: null })
      })
    return () => { cancelled = true }
  }, [loaded, scope, query]))

  const refetch = useCallback(() => {
    setRefreshing(scope)
    api
      .get<CampaignPageResponse>(`/campaigns?page=1&${query}`)
      // A failed refresh keeps the list on screen and only reports the error.
      .then((data) => setState(value => value.scope === scope ? firstPage(scope, data) : value))
      .catch((err: Error) => setState(value => value.scope === scope ? { ...value, error: err.message } : value))
      .finally(() => setRefreshing(value => value === scope ? '' : value))
  }, [scope, query])

  const hasMore = loaded && state.page < state.totalPages
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore === scope) return
    const next = state.page + 1
    setLoadingMore(scope)
    api
      .get<CampaignPageResponse>(`/campaigns?page=${next}&${query}`)
      .then((data) => {
        // Drop a page that arrives after the search changed or was reloaded.
        setState(value => {
          if (value.scope !== scope || value.page !== next - 1) return value
          const seen = new Set(value.campaigns.map(campaign => campaign.id))
          const added = (data.items ?? []).filter(campaign => !seen.has(campaign.id))
          return { ...value, campaigns: [...value.campaigns, ...added], page: next, total: data.total ?? value.total, totalPages: data.totalPages ?? value.totalPages, moreError: null }
        })
      })
      .catch((err: Error) => setState(value => value.scope === scope ? { ...value, moreError: err.message } : value))
      .finally(() => setLoadingMore(value => value === scope ? '' : value))
  }, [hasMore, loadingMore, scope, state.page, query])

  return {
    campaigns: current ? state.campaigns : [],
    total: current ? state.total : 0,
    hasMore,
    isLoading: !current,
    isLoadingMore: loadingMore === scope,
    isRefreshing: refreshing === scope,
    error: current ? state.error : null,
    loadMoreError: current ? state.moreError : null,
    loadMore,
    refetch,
  }
}

export function useCampaign(id: string): UseCampaignResult {
  const { user } = useAuth()
  const scope = `${id}:${user?.id ?? 'guest'}:${user?.role ?? 'guest'}`
  const [loadedScope, setLoadedScope] = useState('')
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [donationError, setDonationError] = useState<string | null>(null)
  useFocusEffect(useCallback(() => {
    if (!id) return
    setIsLoading(true)
    let active = true
    let loading = false
    const load = async () => {
      if (loading) return
      loading = true
      try {
        const data = await api.get<CampaignDetail>(`/campaigns/${id}`)
        if (!active) return
        setCampaign(data); setError(null)
        try {
          const donations = await api.get<{ items: NonNullable<CampaignDetail['donations']> }>(`/campaigns/${id}/donations?pageSize=5`)
          if (active) { setCampaign({ ...data, donations: donations.items }); setDonationError(null) }
        } catch { if (active) setDonationError('Recent donations could not be loaded. We will retry shortly.') }
      } catch (e) { if (active) { setCampaign(null); setDonationError(null); setError(e instanceof Error ? e.message : 'Could not load campaign.') } }
      finally { loading = false; if (active) { setLoadedScope(scope); setIsLoading(false) } }
    }
    void load()
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 30000)
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load() })
    return () => { active = false; clearInterval(timer); listener.remove() }
  }, [id, scope]))
  return { campaign: loadedScope === scope ? campaign : null, isLoading: isLoading || loadedScope !== scope, error: loadedScope === scope ? error : null, donationError: loadedScope === scope ? donationError : null }
}

export function useUser(userId: string): UseUserResult {
  const { user: viewer } = useAuth()
  const scope = `${userId}:${viewer?.id ?? 'guest'}`
  const [state, setState] = useState<{ scope: string; user: User | null }>({ scope: '', user: null })
  useFocusEffect(useCallback(() => {
    if (!userId) return
    let active = true
    let loading = false
    const load = async () => {
      if (loading) return
      loading = true
      try {
        const user = await api.get<User>(`/users/${userId}/public`)
        if (active) setState({ scope, user })
      } catch {
        if (active) setState({ scope, user: null })
      } finally { loading = false }
    }
    void load()
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 30000)
    const listener = AppState.addEventListener('change', status => { if (status === 'active') void load() })
    return () => { active = false; clearInterval(timer); listener.remove() }
  }, [userId, scope]))
  return { user: userId && state.scope === scope ? state.user : null, isLoading: Boolean(userId) && state.scope !== scope }
}
