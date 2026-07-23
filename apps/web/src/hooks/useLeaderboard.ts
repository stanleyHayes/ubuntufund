import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface LeaderboardEntry {
  rank: number
  userId: string
  userRole: 'user' | 'organization'
  name: string
  avatarUrl?: string
  totalDonated: number
  donationCount: number
  currency: string
  campaignsSupported: number
  isAnonymous: boolean
}

export interface LeaderboardStats {
  totalAmount: number
  totalDonations: number
  totalDonors: number
}

export interface FeaturedDonors {
  topAllTime: LeaderboardEntry[]
  topThisMonth: LeaderboardEntry[]
}

export type Period = 'daily' | 'monthly' | 'yearly' | 'lifetime'
export type Category = 'all' | 'user' | 'organization'

interface UseLeaderboardResult {
  entries: LeaderboardEntry[]
  stats: LeaderboardStats
  isLoading: boolean
  error: string | null
}

export function useLeaderboard(
  period: Period = 'lifetime',
  category: Category = 'all',
  limit?: number
): UseLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [stats, setStats] = useState<LeaderboardStats>({ totalAmount: 0, totalDonations: 0, totalDonors: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => setIsLoading(true), 0)

    const params = new URLSearchParams({ period, category })
    if (limit) params.set('limit', String(limit))

    Promise.all([
      api.get<{ data: LeaderboardEntry[] }>(`/leaderboard?${params}`),
      api.get<{ data: LeaderboardStats }>(`/leaderboard/stats?${params}`),
    ])
      .then(([leaderboardRes, statsRes]) => {
        if (!cancelled) {
          // Handle both wrapped { data: [...] } and direct array responses
          const leaderboardData = Array.isArray(leaderboardRes) ? leaderboardRes : leaderboardRes.data ?? []
          const statsData = (statsRes as any).data ?? statsRes
          setEntries(leaderboardData)
          setStats(statsData)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setEntries([])
          setStats({ totalAmount: 0, totalDonations: 0, totalDonors: 0 })
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [period, category, limit])

  return { entries, stats, isLoading, error }
}

interface UseFeaturedDonorsResult {
  featured: FeaturedDonors
  isLoading: boolean
  error: string | null
}

export function useFeaturedDonors(category: Category = 'all', limit: number = 5): UseFeaturedDonorsResult {
  const [featured, setFeatured] = useState<FeaturedDonors>({ topAllTime: [], topThisMonth: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    api
      .get<{ data: FeaturedDonors }>(`/leaderboard/featured?category=${category}&limit=${limit}`)
      .then((res) => {
        if (!cancelled) {
          const data = (res as any).data ?? res
          setFeatured(data)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setFeatured({ topAllTime: [], topThisMonth: [] })
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [category, limit])

  return { featured, isLoading, error }
}
