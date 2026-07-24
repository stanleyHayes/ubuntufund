import { useState, useEffect } from 'react'
import type { Campaign, CampaignDetail } from '@ubuntu-fund/types'
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
