import { useState, useEffect, useCallback } from 'react'
import type { AffiliateDashboard } from '@ubuntu-fund/types'
import { enroll as enrollApi, getAffiliateDashboard } from '@/lib/affiliate'

// ---------------------------------------------------------------------------
// useAffiliate
//
// Loads the current user's affiliate dashboard (GET /affiliate). A `null`
// dashboard means the user is not enrolled yet (the API answers 404) — the
// page shows an enroll CTA in that case. Exposes `enroll()` (joins the program
// then refetches) and `refresh()` (re-runs the dashboard load, e.g. after a
// payout request). Uses the cancelled-flag pattern so a late response never
// writes to an unmounted component.
// ---------------------------------------------------------------------------

interface UseAffiliateResult {
  dashboard: AffiliateDashboard | null
  /** True once the dashboard has loaded and the user has an affiliate record. */
  enrolled: boolean
  isLoading: boolean
  /** True while an enroll request is in flight. */
  isEnrolling: boolean
  error: string | null
  enroll: () => Promise<void>
  refresh: () => void
}

export function useAffiliate(): UseAffiliateResult {
  const [dashboard, setDashboard] = useState<AffiliateDashboard | null>(null)
  const [enrolled, setEnrolled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refresh = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => setIsLoading(true), 0)

    getAffiliateDashboard()
      .then((data) => {
        if (cancelled) return
        setDashboard(data)
        setEnrolled(data !== null)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setDashboard(null)
        setEnrolled(false)
        setError(
          err instanceof Error
            ? err.message
            : 'We could not load your affiliate dashboard. Please try again.',
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [fetchKey])

  const enroll = useCallback(async () => {
    setIsEnrolling(true)
    setError(null)
    try {
      await enrollApi()
      refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not enroll you right now. Please try again.',
      )
      throw err
    } finally {
      setIsEnrolling(false)
    }
  }, [refresh])

  return { dashboard, enrolled, isLoading, isEnrolling, error, enroll, refresh }
}
