import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  markAsRead: (id: string) => Promise<void>
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    api
      .get<Notification[] | { items: Notification[] }>('/notifications')
      .then((data) => {
        if (!cancelled) {
          setNotifications(Array.isArray(data) ? data : (data as any)?.items ?? [])
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setNotifications([])
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
    } catch {
      // Silently fail – the notification will stay unread in the UI
    }
  }, [])

  return { notifications, unreadCount, isLoading, error, markAsRead }
}
