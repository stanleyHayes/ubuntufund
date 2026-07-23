import { useState, useEffect } from 'react'

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

    fetch('/api/v1/payment-providers/enabled')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const data = json.data ?? []
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
