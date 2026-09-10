import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'
import { useAuth } from './AuthContext'
import { api } from '@/lib/api'
export type Notice = { id: string; title: string; message: string; read: boolean }
const Context = createContext<{
  items: Notice[]
  loading: boolean
  error: string
  refresh: () => void
  markRead: (id: string) => Promise<void>
} | null>(null)
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [items, setItems] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const invalidate = useCallback(() => {
    ++generation.current
  }, [])
  const refresh = useCallback(async () => {
    if (!userId) return
    const request = ++generation.current
    try {
      const data = await api.get<Notice[]>('/notifications')
      if (request === generation.current) {
        setItems(data)
        setError('')
      }
    } catch (e) {
      if (request === generation.current)
        setError(e instanceof Error ? e.message : 'Could not load notifications')
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [userId])
  useEffect(() => {
    setItems([])
    setError('')
    setLoading(!!userId)
    void refresh()
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh()
    }, 30000)
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh()
    })
    return () => {
      invalidate()
      clearInterval(timer)
      listener.remove()
    }
  }, [refresh, userId, invalidate])
  const markRead = async (id: string) => {
    const current = generation.current
    try {
      await api.put(`/notifications/${id}/read`, {})
      if (current === generation.current) {
        setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)))
        setError('')
      }
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : 'Could not update notification')
    }
  }
  return (
    <Context.Provider value={{ items, loading, error, refresh: () => void refresh(), markRead }}>
      {children}
    </Context.Provider>
  )
}
export function useNotifications() {
  const value = useContext(Context)
  if (!value) throw new Error('NotificationProvider required')
  return value
}
