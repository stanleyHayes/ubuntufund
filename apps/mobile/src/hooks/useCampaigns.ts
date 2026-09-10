import { useState, useEffect, useCallback } from 'react'
import { AppState } from 'react-native'
import { api } from '@/lib/api'
import type { Campaign, CampaignDetail } from '@ubuntu-fund/types'
import type { User } from '@ubuntu-fund/types'

interface UseCampaignsResult {
  refetch: () => void
  campaigns: Campaign[]
  isLoading: boolean
  error: string | null
}

interface UseCampaignResult {
  campaign: CampaignDetail | null
  donationError: string | null
  isLoading: boolean
  error: string | null
}

interface UseUserResult {
  user: User | null
  isLoading: boolean
}

export function useCampaigns(): UseCampaignsResult {
  const [retry, setRetry] = useState(0)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refetch = useCallback(() => { setIsLoading(true); setError(null); setRetry(value => value + 1) }, [])

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
  }, [retry])

  return { campaigns, isLoading, error, refetch }
}

export function useCampaign(id: string): UseCampaignResult {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [donationError, setDonationError] = useState<string | null>(null)
  useEffect(() => {
    if (!id) return
    let active = true
    let loading = false
    const load = async () => {
      if (loading) return
      loading = true
      try {
        const data = await api.get<CampaignDetail>(`/campaigns/${id}`)
        if (!active) return
        setCampaign(data); setError(null)
        try {
          const donations = await api.get<{ items: NonNullable<CampaignDetail['donations']> }>(`/campaigns/${id}/donations?pageSize=5`)
          if (active) { setCampaign({ ...data, donations: donations.items }); setDonationError(null) }
        } catch { if (active) setDonationError('Recent donations could not be loaded. We will retry shortly.') }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not load campaign.') }
      finally { loading = false; if (active) setIsLoading(false) }
    }
    void load()
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 30000)
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load() })
    return () => { active = false; clearInterval(timer); listener.remove() }
  }, [id])
  return { campaign, isLoading, error, donationError }
}

export function useUser(userId: string): UseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(userId))

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    api
      .get<User>(`/users/${userId}/public`)
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
