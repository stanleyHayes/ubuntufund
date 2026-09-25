import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createBrowserSession } from '@ubuntu-fund/ui/src/browserSession'
import { ColorModeProvider } from '@/context/ColorModeContext'
import { AuthProvider } from '@/context/AuthContext'

/**
 * Blocking site data makes the `localStorage` getter throw SecurityError, and
 * some in-app WebViews (where shared donation links open) have no DOM storage
 * at all. ColorModeProvider sits above the router, and AuthProvider's effect
 * starts the browser session, so a throw in either unmounted the root and
 * blanked every route, /donate included.
 */
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

function blockStorage(mode: 'throws' | 'missing') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      if (mode === 'throws') throw new DOMException('The operation is insecure.', 'SecurityError')
      return null
    },
  })
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original)
  vi.restoreAllMocks()
})

describe.each(['throws', 'missing'] as const)('when storage %s', (mode) => {
  it('still renders the app shell, signed out', () => {
    blockStorage(mode)
    render(
      <ColorModeProvider>
        <AuthProvider>
          <p>Donate page content</p>
        </AuthProvider>
      </ColorModeProvider>,
    )
    expect(screen.getByText('Donate page content')).toBeInTheDocument()
  })

  it('keeps the browser session usable as signed out', async () => {
    blockStorage(mode)
    const session = createBrowserSession({
      tokensKey: 'tokens', userKey: 'user', accessKey: 'accessToken', legacyKeys: ['accessToken'],
      activityKey: 'active', expiredEvent: 'expired', changedEvent: 'changed', refreshUrl: '/auth/refresh',
    })
    expect(session.accessToken()).toBeNull()
    await expect(session.ensureAccessToken()).resolves.toBeNull()
    expect(() => session.resetActivity()).not.toThrow()
    expect(() => session.clear()).not.toThrow()
    expect(() => session.expire()).not.toThrow()
    let stop: (() => void) | undefined
    expect(() => { stop = session.start(() => {}) }).not.toThrow()
    expect(() => window.dispatchEvent(new Event('pointerdown'))).not.toThrow()
    stop?.()
  })
})
