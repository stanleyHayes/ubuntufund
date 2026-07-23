import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Campaign, CampaignDetail } from '@ubuntu-fund/types'
import type { User } from '@ubuntu-fund/types'

interface UseCampaignsResult {
  campaigns: Campaign[]
  isLoading: boolean
  error: string | null
}

interface UseCampaignResult {
  campaign: CampaignDetail | null
  isLoading: boolean
  error: string | null
}

interface UseUserResult {
  user: User | null
  isLoading: boolean
}

export function useCampaigns(): UseCampaignsResult {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<Campaign[] | { items: Campaign[] }>('/campaigns')
      .then((data) => {
        if (!cancelled) {
          setCampaigns(Array.isArray(data) ? data : data.items ?? [])
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { campaigns, isLoading, error }
}

export function useCampaign(id: string): UseCampaignResult {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api
      .get<CampaignDetail>(`/campaigns/${id}`)
      .then((data) => {
        if (!cancelled) setCampaign(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return { campaign, isLoading, error }
}

export function useUser(userId: string): UseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      return
    }
    let cancelled = false
    api
      .get<User>(`/users/${userId}`)
      .then((data) => {
        if (!cancelled) setUser(data)
      })
      .catch(() => {
        // User not found — leave null
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return { user, isLoading }
}
