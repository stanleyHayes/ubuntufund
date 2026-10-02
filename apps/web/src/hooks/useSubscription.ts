import { useState, useEffect, useCallback } from 'react'
import type { Subscription, SubscriptionPlan } from '@ubuntu-fund/types'
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
} from '@ubuntu-fund/types'
import { api } from '@/lib/api'

// ---------------------------------------------------------------------------
// useMySubscription
// ---------------------------------------------------------------------------

interface UseMySubscriptionResult {
  subscription: Subscription | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

const FREE_FALLBACK: Subscription = {
  id: '',
  userId: '',
  tier: SubscriptionTier.FREE,
  status: SubscriptionStatus.ACTIVE,
  billingCycle: BillingCycle.MONTHLY,
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  cancelAtPeriodEnd: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}

export function useMySubscription(): UseMySubscriptionResult {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  function refetch() {
    setFetchKey((k) => k + 1)
  }

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => setIsLoading(true), 0)

    api
      .get<Subscription>('/subscriptions/mine')
      .then((data) => {
        if (!cancelled) {
          // Ensure date fields are actual Date objects
          setSubscription({
            ...data,
            currentPeriodStart: new Date(data.currentPeriodStart),
            currentPeriodEnd: new Date(data.currentPeriodEnd),
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            ...(data.trialEnd ? { trialEnd: new Date(data.trialEnd) } : {}),
          })
          setError(null)
        }
      })
      .catch(() => {
        // Fall back to FREE tier when endpoint is unavailable
        if (!cancelled) {
          setSubscription(FREE_FALLBACK)
          setError(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [fetchKey])

  return { subscription, isLoading, error, refetch }
}

// ---------------------------------------------------------------------------
// usePlanMap
// ---------------------------------------------------------------------------

interface UsePlanMapResult {
  /** Keyed by the (string) tier id so admin-ADDED tiers render too. */
  plans: Record<string, SubscriptionPlan>
  loaded: boolean
  error: boolean
  retry: () => void
}

/**
 * The live plans from `GET /plans`, keyed by tier. Starts empty rather than
 * from the code seed, so a price is never shown that checkout would not
 * charge: callers wait for `loaded` and offer `retry` when `error` is set.
 * `GET /plans` needs a session and a 401 signs the browser out, so a page
 * open to signed-out visitors passes `enabled: false` until it has a plan to
 * show.
 */
export function usePlanMap({ enabled = true }: { enabled?: boolean } = {}): UsePlanMapResult {
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan>>({})
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true
    // Awaited, so a malformed response takes the same path as a failed request.
    const load = async () => {
      try {
        const rows = await api.get<SubscriptionPlan[]>('/plans')
        if (!Array.isArray(rows) || !rows.length) throw new Error('Plans unavailable')
        if (!active) return
        setPlans(Object.fromEntries(rows.filter((plan) => plan?.tier).map((plan) => [plan.tier, plan])))
        setLoaded(true)
      } catch {
        if (active) setError(true)
      }
    }
    load()
    return () => { active = false }
  }, [attempt, enabled])
  const retry = useCallback(() => { setError(false); setAttempt((value) => value + 1) }, [])
  return { plans, loaded, error, retry }
}

/** Signup must show confirmed public prices, never seeded commercial defaults. */
export function useSignupPlans() {
  const [plans, setPlans] = useState<Record<string, SubscriptionPlan>>({})
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    api.get<SubscriptionPlan[]>('/plans/public').then(rows => {
      if (!Array.isArray(rows) || !rows.length) throw new Error('Plans unavailable')
      if (active) setPlans(Object.fromEntries(rows.map(plan => [plan.tier, plan])))
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [attempt])
  return { plans, error, retry: () => { setError(false); setAttempt(value => value + 1) } }
}
