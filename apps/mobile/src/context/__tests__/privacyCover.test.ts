import '@testing-library/jest-dom/vitest'
import { createElement, useEffect } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({
  state: { enabled: false, locked: false }, listener: () => {}, mounted: 0, removed: 0,
  handlers: {} as Record<string, (state?: string) => void>, current: 'active',
  foreground: vi.fn(),
}))
vi.mock('react-native', async () => {
  const React = await import('react')
  return {
    Platform: { OS: 'android' },
    View: ({ children, style, accessibilityElementsHidden, onTouchStart }: { children: React.ReactNode; style: object; accessibilityElementsHidden?: boolean; onTouchStart?: () => void }) => React.createElement('div', { style, 'aria-hidden': accessibilityElementsHidden, onTouchStart }, children),
    AppState: {
      get currentState() { return m.current },
      addEventListener: (event: string, callback: (state?: string) => void) => { m.handlers[event] = callback; return { remove: () => {} } },
    },
  }
})
vi.mock('@/components/BiometricLock', async () => { const React = await import('react'); return { BiometricLock: () => React.createElement('div', { role: 'dialog' }, 'Ujimora is locked') } })
vi.mock('@/components/PrivacyCover', async () => { const React = await import('react'); return { PrivacyCover: () => React.createElement('div', { role: 'img' }, 'Ujimora') } })
vi.mock('@/lib/api', () => ({ loginApi: vi.fn(), registerApi: vi.fn() }))
vi.mock('@/lib/session', () => ({
  biometricSessionState: () => ({ ...m.state }), setSessionForeground: m.foreground, accessToken: async () => null,
  endSession: vi.fn(), establishSession: vi.fn(), expireIdleSession: () => false, hydrateSession: async () => {}, recordActivity: vi.fn(),
  observeSession: (listener: () => void) => { m.listener = listener; return () => {} },
  sessionSnapshot: () => m.state.locked ? null : { user: { id: 'member' }, tokens: { accessToken: 'token' } },
}))
import { AuthProvider, BiometricScreen } from '@/context/AuthContext'
function PrivateBalance() { useEffect(() => { m.mounted++; return () => { m.removed++ } }, []); return createElement('input', { 'aria-label': 'Wallet balance', defaultValue: 'GH₵ 1,250.00' }) }
function renderApp() { return render(createElement(AuthProvider, null, createElement(BiometricScreen, null, createElement(PrivateBalance)))) }
beforeEach(() => { m.state = { enabled: false, locked: false }; m.mounted = 0; m.removed = 0; m.handlers = {}; m.current = 'active'; m.foreground.mockClear() })
afterEach(cleanup)

it('covers private screens for every user while the app is inactive or backgrounded, without unmounting them', async () => {
  renderApp()
  await waitFor(() => expect(m.mounted).toBe(1))
  act(() => { m.current = 'inactive'; m.handlers.change('inactive') })
  expect(screen.getByRole('img')).toHaveTextContent('Ujimora')
  expect(screen.getByLabelText('Wallet balance')).not.toBeVisible()
  expect(screen.queryByRole('dialog')).toBeNull()
  act(() => { m.current = 'background'; m.handlers.change('background') })
  expect(m.foreground).toHaveBeenLastCalledWith(false, true)
  expect(screen.getByLabelText('Wallet balance')).not.toBeVisible()
  act(() => { m.current = 'active'; m.handlers.change('active') })
  expect(m.foreground).toHaveBeenLastCalledWith(true, false)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByLabelText('Wallet balance')).toBeVisible()
  expect(m.mounted).toBe(1)
  expect(m.removed).toBe(0)
})

it('does not blank the app for opted-out users when an in-app modal or the notification shade blurs the Android window', async () => {
  renderApp()
  await waitFor(() => expect(m.mounted).toBe(1))
  act(() => m.handlers.blur())
  expect(m.foreground).toHaveBeenLastCalledWith(false)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByLabelText('Wallet balance')).toBeVisible()
  act(() => m.handlers.focus())
  expect(m.foreground).toHaveBeenLastCalledWith(true)
})

it('shows the suspended lock over, but keeps mounted, an opted-in screen during a blur; only a real lock unmounts it', async () => {
  m.state = { enabled: true, locked: false }
  renderApp()
  await waitFor(() => expect(m.mounted).toBe(1))
  act(() => m.handlers.blur())
  expect(screen.getByRole('dialog')).toHaveTextContent('Ujimora is locked')
  expect(screen.getByLabelText('Wallet balance')).not.toBeVisible()
  expect(m.removed).toBe(0)
  act(() => m.handlers.focus())
  expect(screen.getByLabelText('Wallet balance')).toBeVisible()
  act(() => { m.state.locked = true; m.listener() })
  expect(m.removed).toBe(1)
})
