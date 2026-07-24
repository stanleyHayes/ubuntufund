import { useEffect, useRef } from 'react'

const SSE_BASE_URL = '/api/v1/sse'

// Live updates are opt-in. When VITE_SSE_ENABLED is not exactly 'true' the hook
// is a no-op: it never opens a connection, so a missing /sse route can't spam
// the console with failed-connection errors. Consumers (activity/donation
// feeds) simply degrade to their static/last-known state.
const SSE_ENABLED = import.meta.env.VITE_SSE_ENABLED === 'true'

interface SSEOptions {
  onMessage?: (event: string, data: unknown) => void
  onError?: (error: Event) => void
  onConnect?: () => void
}

export function useSSE(channel: string, options: SSEOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    // Disabled → degrade silently, no connection, no console noise.
    if (!SSE_ENABLED) return

    const maxReconnectAttempts = 10
    const baseReconnectDelay = 1000
    const maxReconnectDelay = 30000

    function connect() {
      if (eventSourceRef.current?.readyState === EventSource.OPEN) {
        return
      }

      const url = channel.startsWith('campaign:')
        ? `${SSE_BASE_URL}/campaigns/${channel.replace('campaign:', '')}/live`
        : `${SSE_BASE_URL}/subscribe/${channel}`

      let es: EventSource
      try {
        es = new EventSource(url)
      } catch {
        // EventSource unavailable/blocked — degrade silently.
        return
      }
      eventSourceRef.current = es

      es.addEventListener('connected', () => {
        reconnectAttemptsRef.current = 0
        optionsRef.current.onConnect?.()
      })

      es.addEventListener('ping', () => {
        reconnectAttemptsRef.current = 0
      })

      es.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data)
          optionsRef.current.onMessage?.(e.type, data)
        } catch {
          optionsRef.current.onMessage?.(e.type, e.data)
        }
      })

      es.addEventListener('donation', (e) => {
        try {
          optionsRef.current.onMessage?.('donation', JSON.parse(e.data))
        } catch {
          optionsRef.current.onMessage?.('donation', e.data)
        }
      })

      es.addEventListener('funded', (e) => {
        try {
          optionsRef.current.onMessage?.('funded', JSON.parse(e.data))
        } catch {
          optionsRef.current.onMessage?.('funded', e.data)
        }
      })

      es.addEventListener('activity', (e) => {
        try {
          optionsRef.current.onMessage?.('activity', JSON.parse(e.data))
        } catch {
          optionsRef.current.onMessage?.('activity', e.data)
        }
      })

      es.onerror = (error) => {
        optionsRef.current.onError?.(error as Event)
        es.close()
        eventSourceRef.current = null

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            baseReconnectDelay * 2 ** reconnectAttemptsRef.current,
            maxReconnectDelay
          )
          reconnectAttemptsRef.current += 1
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [channel])
}
