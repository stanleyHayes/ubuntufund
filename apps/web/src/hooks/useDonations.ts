import { useState, useEffect } from 'react'
import type { PaymentMethod } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

export interface UserDonation {
  id: string
  campaignId: string
  campaignName: string
  amount: number
  currency: string
  date: string
  status: 'completed' | 'pending' | 'refunded'
  paymentMethod: PaymentMethod
}

interface UseMyDonationsResult {
  donations: UserDonation[]
  isLoading: boolean
  error: string | null
}

export function useMyDonations(): UseMyDonationsResult {
  const [donations, setDonations] = useState<UserDonation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    api
      .get<UserDonation[] | { items: UserDonation[] }>('/donations')
      .then((data) => {
        if (!cancelled) {
          setDonations(Array.isArray(data) ? data : data.items ?? [])
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setDonations([])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { donations, isLoading, error }
}
