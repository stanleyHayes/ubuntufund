import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'

/** Live events invalidate data; only current authorized REST responses supply identities. */
export function usePublicFeed<T>(path: string, channel: string, eventName: string) {
  const { user } = useAuth()
  const scope = `${user?.id ?? 'guest'}:${path}`
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<{ scope: string; data: T | null; error: string | null }>({ scope: '', data: null, error: null })
  const onMessage = useCallback((event: string) => {
    if (event !== eventName || timer.current) return
    timer.current = setTimeout(() => { timer.current = null; refresh() }, 300)
  }, [eventName, refresh])
  useSSE(channel, { onMessage })
  useEffect(() => {
    let active = true
    api.get<T>(path).then(data => {
      if (active) setState({ scope, data, error: null })
    }).catch((error: Error) => {
      if (active) setState({ scope, data: null, error: error.message || 'Could not load activity' })
    })
    return () => { active = false }
  }, [path, scope, revision])
  useEffect(() => {
    const refreshVisible = () => { if (!document.hidden) refresh() }
    const interval = window.setInterval(refreshVisible, 30000)
    window.addEventListener('focus', refreshVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshVisible)
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
    }
  }, [scope, refresh])
  const current = state.scope === scope
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !current, refresh }
}
