import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

export interface PublicUser {
  id: string
  name: string
  avatarUrl?: string
  country?: string
  trustScore: number
  verificationLevel: number
  role: string
  createdAt: string
}

export function useUser(userId: string) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      const id = setTimeout(() => setIsLoading(false), 0)
      return () => clearTimeout(id)
    }

    let cancelled = false
    const id = setTimeout(() => setIsLoading(true), 0)

    api
      .get<PublicUser>(`/users/${userId}/public`)
      .then((data) => {
        if (!cancelled) setUser(data)
      })
      .catch(() => {
        // Fallback: construct a minimal user from the ID
        if (!cancelled) {
          setUser({
            id: userId,
            name: 'UbuntuFund User',
            trustScore: 50,
            verificationLevel: 1,
            role: 'user',
            createdAt: new Date().toISOString(),
          })
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [userId])

  return { user, isLoading }
}
