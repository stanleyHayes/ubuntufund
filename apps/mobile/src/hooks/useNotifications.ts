import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(() => {
    setIsLoading(true)
    return Promise.all([
      api.get<Notification[] | { items: Notification[] }>('/notifications'),
      api.get<{ count: number }>('/notifications/unread-count'),
    ])
      .then(([notifs, countRes]) => {
        setNotifications(Array.isArray(notifs) ? notifs : (notifs as any).items ?? [])
        setUnreadCount(countRes.count ?? 0)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get<Notification[] | { items: Notification[] }>('/notifications'),
      api.get<{ count: number }>('/notifications/unread-count'),
    ])
      .then(([notifs, countRes]) => {
        if (cancelled) return
        setNotifications(Array.isArray(notifs) ? notifs : (notifs as any).items ?? [])
        setUnreadCount(countRes.count ?? 0)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    await api.put(`/notifications/${id}/read`)
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnreadCount((c) => Math.max(0, c - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await api.put('/notifications/read-all')
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  return { notifications, unreadCount, isLoading, error, markAsRead, markAllRead, refresh }
}
