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

export function useEnabledPaymentProviders() {
  const [providers, setProviders] = useState<EnabledPaymentProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => setIsLoading(true), 0)

    api.get<EnabledPaymentProvider[]>('/payment-providers/enabled')
      .then((data) => {
        if (cancelled) return
        if (!Array.isArray(data) || data.some((provider) => !provider || typeof provider.name !== 'string' || typeof provider.slug !== 'string' || typeof provider.type !== 'string')) throw new Error('Invalid payment provider response')
        setProviders(data)
        setError(null)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => {
        clearTimeout(id)
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [])

  return { providers, isLoading, error }
}
