import { useState, useEffect } from 'react'
import type { Subscription, SubscriptionPlan } from '@ubuntu-fund/types'
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  SUBSCRIPTION_PLANS,
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

/**
 * The DB-backed plans keyed by tier for display. Seeded from the code-defined
 * `SUBSCRIPTION_PLANS` so cards render immediately with no flash/empty state,
 * then overlaid with the live plans from `GET /plans`. A failed fetch keeps the
 * seeded defaults, so pricing/limits are always shown.
 */
export function usePlanMap(): Record<string, SubscriptionPlan> {
  // Keyed by the (string) tier id so admin-ADDED tiers from GET /plans render too.
  const [planMap, setPlanMap] = useState<Record<string, SubscriptionPlan>>(SUBSCRIPTION_PLANS)

  useEffect(() => {
    let cancelled = false

    api
      .get<SubscriptionPlan[]>('/plans')
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return
        setPlanMap((current) => {
          const next = { ...current }
          for (const plan of data) {
            if (plan && plan.tier) next[plan.tier] = plan
          }
          return next
        })
      })
      .catch(() => {
        // Keep the seeded defaults on failure.
      })

    return () => {
      cancelled = true
    }
  }, [])

  return planMap
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
