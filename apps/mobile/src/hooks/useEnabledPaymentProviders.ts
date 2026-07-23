import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

export interface EnabledPaymentProvider {
  id: string
  name: string
  slug: string
  type: string
  isDefault: boolean
  feePercent: number
}

export function getProviderIcon(type: string): string {
  switch (type) {
    case 'wallet':
      return 'wallet'
    case 'mobile_money':
      return 'cellphone'
    case 'card':
      return 'credit-card'
    case 'bank':
      return 'bank'
    case 'crypto':
      return 'bitcoin'
    default:
      return 'cash'
  }
}

export function useEnabledPaymentProviders() {
  const [providers, setProviders] = useState<EnabledPaymentProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<EnabledPaymentProvider[]>('/payment-providers/enabled')
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setProviders(list)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { providers, isLoading, error }
}
