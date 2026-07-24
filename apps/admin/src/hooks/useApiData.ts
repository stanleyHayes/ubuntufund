import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import {
  useMockData,
  useMockUser,
  useMockCampaign,
  useMockCampaignDonations,
  type PlatformStats,
  type Dispute,
  type PaymentProvider,
  type KYCVerification,
} from '@/hooks/useMockData'
import type { Campaign, User, Donation, AiUsageStats, AiUsageLogEntry } from '@ubuntu-fund/types'

/**
 * The admin donations feed reads the API's PublicDonationDTO
 * (`GET /donations`), which enriches each donation with `donorName` /
 * `campaignTitle` but omits `paymentMethod`. The mock fallback is the plain
 * `Donation` shape (has `paymentMethod`, no donor/campaign names). This
 * superset type lets a page render either source; consumers must treat the
 * non-overlapping fields (`paymentMethod`, `donorName`, `campaignTitle`) as
 * optional and guard access.
 */
export type AdminDonation = Donation & {
  donorName?: string
  campaignTitle?: string
  donorAvatarUrl?: string
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
function coerceToFallbackShape<T>(result: unknown, fallback: T): T {
  if (Array.isArray(fallback)) {
    if (Array.isArray(result)) return result as T
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>
      const inner = obj.items ?? obj.data ?? obj.results
      if (Array.isArray(inner)) return inner as T
    }
    return fallback
  }
  if (fallback && typeof fallback === 'object') {
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return { ...(fallback as object), ...(result as object) } as T
    }
    return fallback
  }
  return (result ?? fallback) as T
}

/**
 * Generic hook: tries the API first, falls back to mock data on failure.
 */
function useApiWithFallback<T>(
  apiPath: string,
  fallbackData: T,
): UseApiResult<T> {
  const [data, setData] = useState<T>(fallbackData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      try {
        const result = await api.get<unknown>(apiPath)
        if (!cancelled) {
          setData(coerceToFallbackShape(result, fallbackData))
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          // Fall back to mock data silently
          setData(fallbackData)
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
 * Fetch campaigns from API with fallback to mock data.
 */
export function useAdminCampaigns(): UseApiResult<Campaign[]> {
  const { campaigns } = useMockData()
  return useApiWithFallback<Campaign[]>('/campaigns?page=1&pageSize=50', campaigns)
}

/**
 * Fetch users from API with fallback to mock data.
 */
export function useAdminUsers(): UseApiResult<User[]> {
  const { users } = useMockData()
  return useApiWithFallback<User[]>('/users?page=1&pageSize=50', users)
}

/**
 * Fetch donations from API with fallback to mock data.
 */
export function useAdminDonations(): UseApiResult<AdminDonation[]> {
  const { donations } = useMockData()
  // GET /donations is the recent-donations feed; it honours ?limit (not
  // page/pageSize) and returns a bare PublicDonationDTO[] array.
  return useApiWithFallback<AdminDonation[]>('/donations?limit=50', donations)
}

/**
 * Fetch disputes from API with fallback to mock data.
 */
export function useAdminDisputes(): UseApiResult<Dispute[]> {
  const { disputes } = useMockData()
  return useApiWithFallback<Dispute[]>('/disputes?page=1&pageSize=50', disputes)
}

/**
 * Fetch platform stats/analytics from API with fallback to mock data.
 */
export function useAdminStats(): UseApiResult<PlatformStats> {
  const { stats } = useMockData()
  return useApiWithFallback<PlatformStats>('/analytics/overview', stats)
}

/**
 * Fetch payment providers from API with fallback to mock data.
 */
export function useAdminPaymentProviders(): UseApiResult<PaymentProvider[]> {
  const { paymentProviders } = useMockData()
  return useApiWithFallback<PaymentProvider[]>('/payment-providers', paymentProviders)
}

/**
 * Fetch AI writing usage stats from API with fallback to mock data.
 */
export function useAiUsageStats(): UseApiResult<AiUsageStats> {
  const { aiUsageStats } = useMockData()
  return useApiWithFallback<AiUsageStats>('/ai-writing/stats', aiUsageStats)
}

/**
 * Fetch AI writing usage log from API with fallback to mock data.
 */
export function useAiUsageLog(): UseApiResult<AiUsageLogEntry[]> {
  const { aiUsageLog } = useMockData()
  return useApiWithFallback<AiUsageLogEntry[]>('/ai-writing/usage', aiUsageLog)
}

/**
 * Fetch KYC verifications from API with fallback to mock data.
 */
export function useAdminKYCVerifications(): UseApiResult<KYCVerification[]> {
  const { kycVerifications } = useMockData()
  return useApiWithFallback<KYCVerification[]>('/kyc/pending', kycVerifications)
}

/**
 * Fetch a single user for the admin detail view.
 *
 * NOTE: the only per-user endpoint is the PUBLIC profile
 * (`GET /users/:id/public` → PublicUserProfileDTO). It intentionally omits
 * admin-only fields such as `email`, `kycStatus`, and `kycLevel`; there is no
 * admin `GET /users/:id`, so those fields are absent on real data and pages
 * must guard them. Falls back to the richer mock user on failure.
 */
export function useAdminUser(id: string): UseApiResult<User | null> {
  const fallback = useMockUser(id) ?? null
  return useApiWithFallback<User | null>(`/users/${id}/public`, fallback)
}

/**
 * Fetch a single campaign for the admin detail view.
 * GET /campaigns/:id is public and returns the full Campaign DTO (incl.
 * donorCount). Falls back to the mock campaign on failure.
 */
export function useAdminCampaign(id: string): UseApiResult<Campaign | null> {
  const fallback = useMockCampaign(id) ?? null
  return useApiWithFallback<Campaign | null>(`/campaigns/${id}`, fallback)
}

/**
 * Fetch the paginated donations for a single campaign.
 * GET /campaigns/:id/donations returns PaginatedResponse<CampaignDonation>
 * (donor name embedded, no donorId). Falls back to mock donations on failure.
 */
export function useAdminCampaignDonations(id: string): UseApiResult<AdminDonation[]> {
  const fallback = useMockCampaignDonations(id)
  return useApiWithFallback<AdminDonation[]>(`/campaigns/${id}/donations?page=1&pageSize=50`, fallback)
}

/**
 * Fetch KYC stats from API with fallback to mock data.
 */
export function useKYCStats(): UseApiResult<{ pending: number; approvedToday: number; rejectedToday: number }> {
  const { kycVerifications } = useMockData()
  const fallback = {
    pending: kycVerifications.filter(v => v.status === 'pending').length,
    approvedToday: kycVerifications.filter(v => v.status === 'approved' && v.reviewedAt && new Date(v.reviewedAt).toDateString() === new Date().toDateString()).length,
    rejectedToday: kycVerifications.filter(v => v.status === 'rejected' && v.reviewedAt && new Date(v.reviewedAt).toDateString() === new Date().toDateString()).length,
  }
  return useApiWithFallback('/kyc/stats', fallback)
}
