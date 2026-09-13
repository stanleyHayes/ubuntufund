import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.hoisted(() => { vi.stubEnv('VITE_SSE_ENABLED', 'true') })
import { useSSE } from '@/hooks/useSSE'
const urls: string[] = []
class TestSource extends EventTarget {
  static OPEN = 1
  readyState = 0
  constructor(url: string) { super(); urls.push(url) }
  close() {}
}
beforeEach(() => { urls.length = 0; vi.stubGlobal('EventSource', TestSource) })
afterEach(() => vi.unstubAllGlobals())
it('opens the implemented campaign SSE endpoint', () => {
  const hook = renderHook(() => useSSE('campaign:abc'))
  expect(urls).toEqual(['/api/v1/campaigns/abc/events'])
  hook.unmount()
})
it('does not attempt a nonexistent global stream', () => {
  renderHook(() => useSSE('global'))
  expect(urls).toEqual([])
})
