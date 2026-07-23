import { useState, useEffect } from 'react'
import type { CampaignUpdate, CreateCampaignUpdateInput } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

interface UseCampaignUpdatesResult {
  updates: CampaignUpdate[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useCampaignUpdates(campaignId: string): UseCampaignUpdatesResult {
  const [updates, setUpdates] = useState<CampaignUpdate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId) return
    let cancelled = false
    api
      .get<{ items: CampaignUpdate[] }>(`/campaigns/${campaignId}/updates`)
      .then((data) => {
        if (!cancelled) {
          setUpdates(data.items ?? [])
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setUpdates([])
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [campaignId])

  const refetch = () => {
    if (!campaignId) return
    setIsLoading(true)
    api
      .get<{ items: CampaignUpdate[] }>(`/campaigns/${campaignId}/updates`)
      .then((data) => {
        setUpdates(data.items ?? [])
        setError(null)
      })
      .catch((err: Error) => {
        setError(err.message)
        setUpdates([])
      })
      .finally(() => setIsLoading(false))
  }

  return { updates, isLoading, error, refetch }
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
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { create, isLoading, error }
}

export function useUpdateCampaignUpdate() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = async (
    campaignId: string,
    updateId: string,
    input: Partial<CreateCampaignUpdateInput>
  ): Promise<CampaignUpdate | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.put<CampaignUpdate>(`/campaigns/${campaignId}/updates/${updateId}`, input)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { update, isLoading, error }
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
