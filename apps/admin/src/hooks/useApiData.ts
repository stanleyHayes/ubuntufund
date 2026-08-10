import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import {
  type PlatformStats,
  type Dispute,
  type PaymentProvider,
  type KYCVerification,
} from '@/hooks/useMockData'
import type { Campaign, User, Donation, AiUsageStats, AiUsageLogEntry } from '@ubuntu-fund/types'

/**
 * The admin donations feed reads the API's PublicDonationDTO
 * (`GET /donations`), which enriches each persisted donation with donor,
 * campaign, and payment-method data.
 */
export type AdminDonation = Donation & {
  donorName?: string
  campaignTitle?: string
  donorAvatarUrl?: string
}

export interface AnalyticsReports {
  donationTrend: Array<{ month: string; amount: number }>
  categoryBreakdown: Array<{ category: string; value: number }>
  geographicData: Array<{ country: string; campaigns: number; donations: number }>
  fraudMetrics: Array<{ metric: string; value: number; change: number }>
}

interface UseApiResult<T> {
  data: T
  isLoading: boolean
  error: string | null
}

/**
 * Reconcile a raw API payload with the expected fallback shape so consumers
 * ALWAYS receive the shape they render.
 *
 * The backend's list endpoints return a paginated envelope
 * (`{ items, total, page, pageSize, totalPages }`) while `api.get` only unwraps
 * the outer `json.data`. Without this guard a collection hook would hand a
 * consumer that inner object, and calling `.filter`/`.map` on it throws
 * "campaigns.filter is not a function". For array fallbacks we unwrap the
 * common envelope keys and guarantee an array; for object fallbacks we merge
 * the response over the defaults so no expected field is ever undefined.
 */
function coerceToInitialShape<T>(result: unknown, initialData: T): T {
  if (Array.isArray(initialData)) {
    if (Array.isArray(result)) return result as T
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>
      const inner = obj.items ?? obj.data ?? obj.results
      if (Array.isArray(inner)) return inner as T
    }
    return initialData
  }
  if (initialData && typeof initialData === 'object') {
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return { ...(initialData as object), ...(result as object) } as T
    }
    return initialData
  }
  return (result ?? initialData) as T
}

/**
 * Generic API hook with a truthful empty initial state. Request failures keep
 * the safe empty value and expose an error; production screens never render
 * demonstration records as if they came from the backend.
 */
function useApiWithFallback<T>(
  apiPath: string,
  initialData: T,
): UseApiResult<T> {
  const [data, setData] = useState<T>(initialData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        const result = await api.get<unknown>(apiPath)
        if (!cancelled) {
          setData(coerceToInitialShape(result, initialData))
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setData(initialData)
          setError(err instanceof Error ? err.message : 'API unavailable')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath])

  return { data, isLoading, error }
}

/**
 * Fetch campaigns from the API with a truthful empty state on failure.
 */
export function useAdminCampaigns(): UseApiResult<Campaign[]> {
  return useApiWithFallback<Campaign[]>('/campaigns?page=1&pageSize=50', [])
}

/**
 * Fetch users from the API with a truthful empty state on failure.
 */
export function useAdminUsers(): UseApiResult<User[]> {
  return useApiWithFallback<User[]>('/users?page=1&pageSize=50', [])
}

/**
 * Fetch donations from the API with a truthful empty state on failure.
 */
export function useAdminDonations(): UseApiResult<AdminDonation[]> {
  // GET /donations is the recent-donations feed; it honours ?limit (not
  // page/pageSize) and returns a bare PublicDonationDTO[] array.
  return useApiWithFallback<AdminDonation[]>('/donations?limit=50', [])
}

/**
 * Fetch disputes from the API with a truthful empty state on failure.
 */
export function useAdminDisputes(): UseApiResult<Dispute[]> {
  return useApiWithFallback<Dispute[]>('/disputes?page=1&pageSize=50', [])
}

/**
 * Fetch platform stats/analytics from the API.
 */
export function useAdminStats(): UseApiResult<PlatformStats> {
  return useApiWithFallback<PlatformStats>('/analytics/overview', {
    totalRaised: 0,
    activeCampaigns: 0,
    totalUsers: 0,
    pendingDisputes: 0,
    totalDonations: 0,
    avgDonation: 0,
    conversionRate: 0,
    monthlyGrowth: 0,
  })
}

export function useAdminReports(): UseApiResult<AnalyticsReports> {
  return useApiWithFallback<AnalyticsReports>('/analytics/reports', {
    donationTrend: [],
    categoryBreakdown: [],
    geographicData: [],
    fraudMetrics: [],
  })
}

/**
 * Fetch payment providers from the API.
 */
export function useAdminPaymentProviders(): UseApiResult<PaymentProvider[]> {
  return useApiWithFallback<PaymentProvider[]>('/payment-providers', [])
}

/**
 * Fetch AI writing usage stats from the API.
 */
export function useAiUsageStats(): UseApiResult<AiUsageStats> {
  return useApiWithFallback<AiUsageStats>('/ai-writing/stats', {
    userId: '',
    totalRequests: 0,
    requestsToday: 0,
    requestsThisMonth: 0,
    lastUsedAt: new Date(0),
  })
}

/**
 * Fetch AI writing usage log from the API.
 */
export function useAiUsageLog(): UseApiResult<AiUsageLogEntry[]> {
  return useApiWithFallback<AiUsageLogEntry[]>('/ai-writing/usage', [])
}

/**
 * Fetch KYC verifications from the API.
 */
export function useAdminKYCVerifications(): UseApiResult<KYCVerification[]> {
  return useApiWithFallback<KYCVerification[]>('/kyc/pending', [])
}

/**
 * Fetch a single user for the admin detail view.
 *
 * Uses the admin-only detail endpoint so sensitive fields are never sourced
 * from a public profile or filled with demonstration data.
 */
export function useAdminUser(id: string): UseApiResult<User | null> {
  return useApiWithFallback<User | null>(`/users/${id}`, null)
}

/**
 * Fetch a single campaign for the admin detail view.
 * GET /campaigns/:id is public and returns the full Campaign DTO (incl.
 * donorCount). Failures remain explicit rather than substituting demo data.
 */
export function useAdminCampaign(id: string): UseApiResult<Campaign | null> {
  return useApiWithFallback<Campaign | null>(`/campaigns/${id}`, null)
}

/**
 * Fetch the paginated donations for a single campaign.
 * GET /campaigns/:id/donations returns PaginatedResponse<CampaignDonation>
 * (donor name embedded, no donorId). Failures remain explicit.
 */
export function useAdminCampaignDonations(id: string): UseApiResult<AdminDonation[]> {
  return useApiWithFallback<AdminDonation[]>(`/campaigns/${id}/donations?page=1&pageSize=50`, [])
}

/**
 * Fetch KYC stats from the API.
 */
export function useKYCStats(): UseApiResult<{ pending: number; approvedToday: number; rejectedToday: number }> {
  return useApiWithFallback('/kyc/stats', {
    pending: 0,
    approvedToday: 0,
    rejectedToday: 0,
  })
}
