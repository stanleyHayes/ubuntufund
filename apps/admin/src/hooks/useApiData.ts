import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useMockData, type PlatformStats, type Dispute, type PaymentProvider, type KYCVerification } from '@/hooks/useMockData'
import type { Campaign, User, Donation, AiUsageStats, AiUsageLogEntry } from '@ubuntu-fund/types'

interface UseApiResult<T> {
  data: T
  isLoading: boolean
  error: string | null
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
        const result = await api.get<T>(apiPath)
        if (!cancelled) {
          setData(result)
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
export function useAdminDonations(): UseApiResult<Donation[]> {
  const { donations } = useMockData()
  return useApiWithFallback<Donation[]>('/donations?page=1&pageSize=50', donations)
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
