import { useEffect, useRef, useCallback, useState } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'

function getSSEBase(): string {
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0]

  if (expoHost && expoHost !== 'localhost') {
    return `http://${expoHost}:8100/api/v1/sse`
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8100/api/v1/sse'
  }

  return 'http://localhost:8100/api/v1/sse'
}

const SSE_BASE_URL = getSSEBase()

interface UseSSEOptions {
  onMessage?: (event: string, data: unknown) => void
  onError?: (error: Error) => void
}

export function useSSE(channel: string, options: UseSSEOptions = {}) {
  const { onMessage, onError } = options
  const abortRef = useRef<AbortController | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 10
  const baseReconnectDelay = 1000
  const maxReconnectDelay = 30000
  const [connected, setConnected] = useState(false)

  const connect = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const url = channel.startsWith('campaign:')
      ? `${SSE_BASE_URL}/campaigns/${channel.replace('campaign:', '')}/live`
      : `${SSE_BASE_URL}/subscribe/${channel}`

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
        },
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      reconnectAttemptsRef.current = 0
      setConnected(true)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let currentEvent = 'message'
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            currentData = line.slice(5).trim()
          } else if (line.trim() === '') {
            if (currentData) {
              try {
                const parsed = JSON.parse(currentData)
                onMessage?.(currentEvent, parsed)
              } catch {
                onMessage?.(currentEvent, currentData)
              }
            }
            currentEvent = 'message'
            currentData = ''
          }
        }
      }

      setConnected(false)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setConnected(false)
      onError?.(err as Error)

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
  }, [channel, onMessage, onError])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      abortRef.current?.abort()
    }
  }, [connect])

  return { connected }
}
