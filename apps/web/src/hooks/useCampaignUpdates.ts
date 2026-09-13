import { useState, useEffect } from 'react'
import type { CampaignUpdate, CreateCampaignUpdateInput } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

interface UseCampaignUpdatesResult {
  updates: CampaignUpdate[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useCampaignUpdates(campaignId: string, viewerId?: string): UseCampaignUpdatesResult {
  const scope = `${campaignId}:${viewerId ?? 'guest'}`
  const [refresh, setRefresh] = useState(0)
  const requestKey = `${scope}:${refresh}`
  const [state, setState] = useState<{ scope: string; updates: CampaignUpdate[]; error: string | null; loading: boolean }>({ scope: '', updates: [], error: null, loading: true })

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    api.get<{ items: CampaignUpdate[] }>(`/campaigns/${campaignId}/updates`)
      .then(data => { if (!cancelled) setState({ scope: requestKey, updates: data.items ?? [], error: null, loading: false }) })
      .catch((error: Error) => { if (!cancelled) setState({ scope: requestKey, updates: [], error: error.message, loading: false }) })
    return () => { cancelled = true }
  }, [campaignId, requestKey])

  useEffect(() => {
    const refreshOnFocus = () => { if (document.visibilityState === 'visible') setRefresh(value => value + 1) }
    window.addEventListener('focus', refreshOnFocus)
    const timer = window.setInterval(refreshOnFocus, 30000)
    return () => { window.removeEventListener('focus', refreshOnFocus); window.clearInterval(timer) }
  }, [])

  return {
    updates: state.scope === requestKey ? state.updates : [],
    isLoading: state.scope !== requestKey || state.loading,
    error: state.scope === requestKey ? state.error : null,
    refetch: () => setRefresh(value => value + 1),
  }
}

export function useCreateCampaignUpdate() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async (
    campaignId: string,
    input: CreateCampaignUpdateInput
  ): Promise<CampaignUpdate | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.post<CampaignUpdate>(`/campaigns/${campaignId}/updates`, input)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create update')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return { create, isLoading, error }
}

export function useDeleteCampaignUpdate() {
  const [isLoading, setIsLoading] = useState(false)

  const deleteUpdate = async (campaignId: string, updateId: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      await api.delete(`/campaigns/${campaignId}/updates/${updateId}`)
      return true
    } catch {
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return { deleteUpdate, isLoading }
}

export function usePinCampaignUpdate() {
  const [isLoading, setIsLoading] = useState(false)

  const pin = async (campaignId: string, updateId: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      await api.post(`/campaigns/${campaignId}/updates/${updateId}/pin`)
      return true
    } catch {
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return { pin, isLoading }
}
