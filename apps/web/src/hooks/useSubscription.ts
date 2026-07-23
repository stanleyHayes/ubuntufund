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
// useSubscriptionPlans
// ---------------------------------------------------------------------------

interface UseSubscriptionPlansResult {
  plans: SubscriptionPlan[]
  isLoading: boolean
}

export function useSubscriptionPlans(): UseSubscriptionPlansResult {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    api
      .get<SubscriptionPlan[]>('/subscriptions/plans')
      .then((data) => {
        if (!cancelled) setPlans(data)
      })
      .catch(() => {
        // Fall back to the static plan definitions from the types package
        if (!cancelled) {
          setPlans(Object.values(SUBSCRIPTION_PLANS))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { plans, isLoading }
}
