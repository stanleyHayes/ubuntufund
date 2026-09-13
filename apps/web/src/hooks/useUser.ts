import { useAuth } from '@/context/AuthContext'
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
  const { user: viewer } = useAuth()
  const scope = `${userId}:${viewer?.id ?? 'guest'}`
  const [state, setState] = useState<{ scope: string; user: PublicUser | null }>({ scope: '', user: null })

  useEffect(() => {
    if (!userId) return
    let active = true
    let loading = false
    const load = async () => {
      if (loading) return
      loading = true
      try {
        const user = await api.get<PublicUser>(`/users/${userId}/public`)
        if (active) setState({ scope, user })
      } catch {
        if (active) setState({ scope, user: null })
      } finally { loading = false }
    }
    void load()
    const refresh = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = window.setInterval(refresh, 30000)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.clearInterval(timer)
    }
  }, [userId, scope])

  return { user: userId && state.scope === scope ? state.user : null, isLoading: Boolean(userId) && state.scope !== scope }
}
