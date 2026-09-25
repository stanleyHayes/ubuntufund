import { useAuth } from '@/context/AuthContext'
import { useState, useEffect, useCallback } from 'react'
import type { Campaign, CampaignCategory, CampaignPriority, CampaignStatus } from '@ubuntu-fund/types'
import { api, ApiError } from '@/lib/api'

/**
 * Normalise any `/campaigns` response into a Campaign[].
 * The API wraps its payload as `{ data: { items: [...] } }`; the api client
 * unwraps the outer `data`, so this hook receives the paginated object (NOT an
 * array). Error / unexpected shapes (null, an error envelope, a primitive, or a
 * payload whose `items` is not an array) all collapse to `[]` so consumers that
 * call `.filter`/`.map` never throw "x.filter is not a function".
 */
function toCampaignArray(data: unknown): Campaign[] {
  if (Array.isArray(data)) return data as Campaign[]
  if (data && typeof data === 'object') {
    const items = (data as { items?: unknown }).items
    if (Array.isArray(items)) return items as Campaign[]
  }
  return []
}

interface UseCampaignsResult {
  campaigns: Campaign[]
  isLoading: boolean
  error: string | null
}

interface UseCampaignResult {
  refresh: () => void
  campaign: Campaign | null
  isLoading: boolean
  error: string | null
}

const noCampaigns: Campaign[] = []
const campaignValue = (value: unknown) => value as Campaign | null

/** Never retain another viewer's private campaign data during a new request. */
function useCampaignData<T>(path: string, empty: T, parse: (value: unknown) => T) {
  const { user } = useAuth()
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  const key = `${path}:${user?.id ?? 'guest'}:${user?.role ?? 'guest'}:${revision}`
  const [state, setState] = useState<{ key: string; data: T; error: string | null }>({ key: '', data: empty, error: null })
  useEffect(() => {
    let cancelled = false
    api.get<unknown>(path).then(data => {
      if (!cancelled) setState({ key, data: parse(data), error: null })
    }).catch((error: Error) => {
      if (!cancelled) setState({ key, data: empty, error: error instanceof ApiError && error.status === 404 ? null : error.message })
    })
    return () => { cancelled = true }
  }, [path, key, empty, parse])
  useEffect(() => {
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  return { data: state.key === key ? state.data : empty, error: state.key === key ? state.error : null, isLoading: state.key !== key, refresh }
}

export function useCampaigns(): UseCampaignsResult {
  const result = useCampaignData('/campaigns', noCampaigns, toCampaignArray)
  return { campaigns: result.data, isLoading: result.isLoading, error: result.error }
}

/**
 * Server-side discovery query. The API filters by *effective* status (an
 * ACTIVE campaign past its end date is EXPIRED), searches titles and pages, so
 * every public campaign is reachable, not only the newest page.
 */
export interface CampaignSearchParams {
  q?: string
  category?: CampaignCategory | null
  status?: CampaignStatus | 'open' | null
  sortBy?: 'createdAt' | 'raisedAmount' | 'endDate' | 'fundedPercent'
  sortOrder?: 'asc' | 'desc'
  page: number
  pageSize: number
}

export function campaignSearchPath(params: CampaignSearchParams): string {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) })
  const q = params.q?.trim().slice(0, 100)
  if (q) query.set('q', q)
  if (params.category) query.set('category', params.category)
  if (params.status) query.set('status', params.status)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  return `/campaigns?${query.toString()}`
}

interface CampaignPage { campaigns: Campaign[]; total: number; totalPages: number }
const emptyCampaignPage: CampaignPage = { campaigns: [], total: 0, totalPages: 0 }
function toCampaignPage(data: unknown): CampaignPage {
  const campaigns = toCampaignArray(data)
  const meta = data && typeof data === 'object' ? data as { total?: unknown; totalPages?: unknown } : {}
  const total = typeof meta.total === 'number' && Number.isFinite(meta.total) ? meta.total : campaigns.length
  const totalPages = typeof meta.totalPages === 'number' && Number.isFinite(meta.totalPages) ? meta.totalPages : (campaigns.length ? 1 : 0)
  return { campaigns, total, totalPages }
}

export function useCampaignSearch(params: CampaignSearchParams): CampaignPage & { isLoading: boolean; error: string | null } {
  const result = useCampaignData(campaignSearchPath(params), emptyCampaignPage, toCampaignPage)
  return { ...result.data, isLoading: result.isLoading, error: result.error }
}

export function useMyCampaigns(): UseCampaignsResult {
  const result = useCampaignData('/campaigns/mine', noCampaigns, toCampaignArray)
  return { campaigns: result.data, isLoading: result.isLoading, error: result.error }
}

// ---------------------------------------------------------------------------
// useCreateCampaign — real POST /campaigns (auth token attached by api client)
// ---------------------------------------------------------------------------

/** Payload sent to POST /campaigns. `imageUrls` carries the cover image. */
interface CreateCampaignPayload {
  automatedReviewConsent?: boolean
  title: string
  summary: string
  category: CampaignCategory
  description: string
  beneficiaries: string[]
  imageUrls: string[]
  goalAmount: number
  currency: string
  endDate: string
  priority: CampaignPriority
}

interface UseCreateCampaignResult {
  /** Reuse `idempotencyKey` when resubmitting the same version after a lost response. */
  createCampaign: (payload: CreateCampaignPayload, idempotencyKey?: string) => Promise<Campaign>
  isSubmitting: boolean
  error: string | null
  reset: () => void
}

export function useCreateCampaign(): UseCreateCampaignResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createCampaign = useCallback(async (payload: CreateCampaignPayload, idempotencyKey?: string): Promise<Campaign> => {
    setIsSubmitting(true)
    setError(null)
    try {
      return await api.post<Campaign>('/campaigns', payload, idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create your campaign. Please try again.'
      setError(message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const reset = useCallback(() => setError(null), [])

  return { createCampaign, isSubmitting, error, reset }
}

export function useCampaign(id: string): UseCampaignResult {
  const result = useCampaignData(`/campaigns/${id}`, null, campaignValue)
  return { campaign: result.data, isLoading: result.isLoading, error: result.error, refresh: result.refresh }
}
