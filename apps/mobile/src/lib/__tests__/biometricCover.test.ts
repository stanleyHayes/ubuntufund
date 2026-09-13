import '@testing-library/jest-dom/vitest'
import { createElement, useEffect } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ state: { enabled: true, locked: false }, listener: () => {}, appChange: (_state: string) => {}, mounted: 0, removed: 0 }))
vi.mock('react-native', async () => {
  const React = await import('react')
  return { Platform: { OS: 'ios' }, View: ({ children, style, accessibilityElementsHidden }: { children: React.ReactNode; style: object; accessibilityElementsHidden?: boolean }) => React.createElement('div', { style, 'aria-hidden': accessibilityElementsHidden }, children), AppState: { currentState: 'active', addEventListener: (_event: string, callback: (state: string) => void) => { m.appChange = callback; return { remove: () => {} } } } }
})
vi.mock('@/components/BiometricLock', async () => { const React = await import('react'); return { BiometricLock: () => React.createElement('div', { role: 'dialog' }, 'Ujimora is locked') } })
vi.mock('@/lib/api', () => ({ loginApi: vi.fn(), registerApi: vi.fn() }))
vi.mock('@/lib/session', () => ({
  biometricSessionState: () => ({ ...m.state }), setSessionForeground: vi.fn(), accessToken: async () => null,
  endSession: vi.fn(), establishSession: vi.fn(), expireIdleSession: () => false, hydrateSession: async () => {}, recordActivity: vi.fn(),
  observeSession: (listener: () => void) => { m.listener = listener; return () => {} },
  sessionSnapshot: () => m.state.locked ? null : { user: { id: 'member' }, tokens: { accessToken: 'token' } },
}))
import { AuthProvider, BiometricScreen } from '@/context/AuthContext'
function PrivateForm() { useEffect(() => { m.mounted++; return () => { m.removed++ } }, []); return createElement('input', { 'aria-label': 'Private recovery draft', defaultValue: 'private-value' }) }
beforeEach(() => { m.state = { enabled: true, locked: false }; m.mounted = 0; m.removed = 0 })
afterEach(cleanup)
it('hides mounted private content during a system prompt, then removes it on an actual lock', async () => {
  const navigatorUnmounted = vi.fn()
  function Navigator() {
    useEffect(() => () => navigatorUnmounted(), [])
    return createElement(BiometricScreen, null, createElement(PrivateForm))
  }
  render(createElement(AuthProvider, null, createElement(Navigator)))
  await waitFor(() => expect(m.mounted).toBe(1))
  act(() => m.appChange('inactive'))
  expect(screen.getByRole('dialog')).toHaveTextContent('Ujimora is locked')
  expect(screen.getByLabelText('Private recovery draft')).not.toBeVisible()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(m.removed).toBe(0)
  act(() => m.appChange('active'))
  expect(screen.getByRole('textbox')).toHaveValue('private-value')
  expect(m.mounted).toBe(1)
  act(() => { m.state.locked = true; m.listener() })
  expect(screen.queryByLabelText('Private recovery draft')).toBeNull()
  expect(m.removed).toBe(1)
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(navigatorUnmounted).not.toHaveBeenCalled()
  act(() => { m.state.locked = false; m.listener() })
  expect(screen.getByRole('textbox')).toBeVisible()
  expect(m.mounted).toBe(2)
  expect(navigatorUnmounted).not.toHaveBeenCalled()
})
