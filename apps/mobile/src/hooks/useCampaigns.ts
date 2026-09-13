import { useAuth } from '@/context/AuthContext'
import { useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
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
  const { user } = useAuth()
  const [retry, setRetry] = useState(0)
  const scope = `${user?.id ?? 'guest'}:${user?.role ?? 'guest'}:${retry}`
  const [loadedScope, setLoadedScope] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refetch = useCallback(() => { setIsLoading(true); setError(null); setRetry(value => value + 1) }, [])

  useFocusEffect(useCallback(() => {
    setIsLoading(true)
    let cancelled = false
    api
      .get<Campaign[] | { items: Campaign[] }>('/campaigns')
      .then((data) => {
        if (!cancelled) {
          setCampaigns(Array.isArray(data) ? data : data.items ?? [])
        }
      })
      .catch((err) => {
        if (!cancelled) { setCampaigns([]); setError(err.message) }
      })
      .finally(() => {
        if (!cancelled) { setLoadedScope(scope); setIsLoading(false) }
      })
    return () => {
      cancelled = true
    }
  }, [scope]))

  return { campaigns: loadedScope === scope ? campaigns : [], isLoading: isLoading || loadedScope !== scope, error: loadedScope === scope ? error : null, refetch }
}

export function useCampaign(id: string): UseCampaignResult {
  const { user } = useAuth()
  const scope = `${id}:${user?.id ?? 'guest'}:${user?.role ?? 'guest'}`
  const [loadedScope, setLoadedScope] = useState('')
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [donationError, setDonationError] = useState<string | null>(null)
  useFocusEffect(useCallback(() => {
    if (!id) return
    setIsLoading(true)
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
      } catch (e) { if (active) { setCampaign(null); setDonationError(null); setError(e instanceof Error ? e.message : 'Could not load campaign.') } }
      finally { loading = false; if (active) { setLoadedScope(scope); setIsLoading(false) } }
    }
    void load()
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 30000)
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load() })
    return () => { active = false; clearInterval(timer); listener.remove() }
  }, [id, scope]))
  return { campaign: loadedScope === scope ? campaign : null, isLoading: isLoading || loadedScope !== scope, error: loadedScope === scope ? error : null, donationError: loadedScope === scope ? donationError : null }
}

export function useUser(userId: string): UseUserResult {
  const { user: viewer } = useAuth()
  const scope = `${userId}:${viewer?.id ?? 'guest'}`
  const [state, setState] = useState<{ scope: string; user: User | null }>({ scope: '', user: null })
  useFocusEffect(useCallback(() => {
    if (!userId) return
    let active = true
    let loading = false
    const load = async () => {
      if (loading) return
      loading = true
      try {
        const user = await api.get<User>(`/users/${userId}/public`)
        if (active) setState({ scope, user })
      } catch {
        if (active) setState({ scope, user: null })
      } finally { loading = false }
    }
    void load()
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 30000)
    const listener = AppState.addEventListener('change', status => { if (status === 'active') void load() })
    return () => { active = false; clearInterval(timer); listener.remove() }
  }, [userId, scope]))
  return { user: userId && state.scope === scope ? state.user : null, isLoading: Boolean(userId) && state.scope !== scope }
}
