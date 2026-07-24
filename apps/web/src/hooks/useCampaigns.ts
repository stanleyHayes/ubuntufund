import { useState, useEffect, useCallback } from 'react'
import type { Campaign, CampaignDetail, CampaignCategory, CampaignPriority } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

/**
 * Normalise any `/campaigns` response into a Campaign[].
 * The API wraps its payload as `{ data: { items: [...] } }`; the api client
 * unwraps the outer `data`, so this hook receives the paginated object (NOT an
 * array). Error / unexpected shapes (null, an error envelope, a primitive, or a
 * payload whose `items` is not an array) all collapse to `[]` so consumers that
 * call `.filter`/`.map` never throw "x.filter is not a function".
 */
function toCampaignArray(data: unknown): Campaign[] {
  if (Array.isArray(data)) return data as Campaign[]
  if (data && typeof data === 'object') {
    const items = (data as { items?: unknown }).items
    if (Array.isArray(items)) return items as Campaign[]
  }
  return []
}

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
          setCampaigns(toCampaignArray(data))
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setCampaigns([])
        }
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

// ---------------------------------------------------------------------------
// useCreateCampaign — real POST /campaigns (auth token attached by api client)
// ---------------------------------------------------------------------------

/** Payload sent to POST /campaigns. `imageUrls` carries the cover image. */
export interface CreateCampaignPayload {
  title: string
  summary: string
  category: CampaignCategory
  description: string
  beneficiaries: string[]
  imageUrls: string[]
  goalAmount: number
  currency: string
  endDate: string
  priority: CampaignPriority
}

interface UseCreateCampaignResult {
  createCampaign: (payload: CreateCampaignPayload) => Promise<Campaign>
  isSubmitting: boolean
  error: string | null
  reset: () => void
}

export function useCreateCampaign(): UseCreateCampaignResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createCampaign = useCallback(async (payload: CreateCampaignPayload): Promise<Campaign> => {
    setIsSubmitting(true)
    setError(null)
    try {
      return await api.post<Campaign>('/campaigns', payload)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create your campaign. Please try again.'
      setError(message)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const reset = useCallback(() => setError(null), [])

  return { createCampaign, isSubmitting, error, reset }
}

export function useCampaign(id: string): UseCampaignResult {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    api
      .get<CampaignDetail>(`/campaigns/${id}`)
      .then((data) => {
        if (!cancelled) {
          setCampaign(data)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setCampaign(null)
        }
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
