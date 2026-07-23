import '@testing-library/jest-dom/vitest'

// Mock EventSource for SSE hooks
globalThis.EventSource = class EventSource {
  url: string
  readyState = 0
  onopen: ((this: EventSource, ev: Event) => void) | null = null
  onmessage: ((this: EventSource, ev: MessageEvent) => void) | null = null
  onerror: ((this: EventSource, ev: Event) => void) | null = null
  constructor(url: string | URL) { this.url = String(url) }
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true }
} as unknown as typeof EventSource
