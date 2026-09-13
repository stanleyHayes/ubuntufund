import { useCallback, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '@/context/AuthContext'

/** Scope public results to the viewer and resource; revoke cached data on denied refresh. */
export function usePublicRead<T>(resource: string, fetchData: () => Promise<T>) {
  const { user } = useAuth()
  const [revision, setRevision] = useState(0)
  const scope = `${user?.id ?? 'guest'}:${resource}:${revision}`
  const [state, setState] = useState<{ scope: string; data: T | null; error: string | null }>({ scope: '', data: null, error: null })
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useFocusEffect(useCallback(() => {
    let active = true
    let loading = false
    const load = async () => {
      if (loading) return
      loading = true
      try {
        const data = await fetchData()
        if (active) setState({ scope, data, error: null })
      } catch (error) {
        if (active) setState({ scope, data: null, error: error instanceof Error ? error.message : 'Unable to load. Please retry.' })
      } finally { loading = false }
    }
    void load()
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 30000)
    const listener = AppState.addEventListener('change', status => { if (status === 'active') void load() })
    return () => { active = false; clearInterval(timer); listener.remove() }
  }, [scope, fetchData]))
  return { data: state.scope === scope ? state.data : null, error: state.scope === scope ? state.error : null, loading: state.scope !== scope, refresh }
}
