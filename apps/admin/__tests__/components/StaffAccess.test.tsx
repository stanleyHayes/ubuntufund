import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post } }))
import { AuthProvider, NO_STAFF_ACCESS, useAuth } from '@/context/AuthContext'
import AuthGuard from '@/components/AuthGuard'
import AdminMfaPrompt from '@/components/layout/AdminMfaPrompt'

const tokens = { accessToken: 'access', refreshToken: 'refresh' }
function storeSession(role: string) {
  localStorage.setItem('uf_admin_user', JSON.stringify({ id: 'u1', name: 'Staff', email: 's@example.test', role }))
  localStorage.setItem('uf_admin_tokens', JSON.stringify(tokens))
  localStorage.setItem('uf_admin_token', tokens.accessToken)
}
let auth: ReturnType<typeof useAuth>
const capture = (value: ReturnType<typeof useAuth>) => { auth = value }
function Capture({ onAuth }: { onAuth: typeof capture }) { const value = useAuth(); useEffect(() => onAuth(value)); return null }
const guarded = (initial = '/') => render(<AuthProvider><Capture onAuth={capture} /><MemoryRouter initialEntries={[initial]}><Routes>
  <Route path="/login" element={<p>Sign-in page</p>} />
  <Route path="/" element={<AuthGuard><p>Console home</p></AuthGuard>} />
</Routes></MemoryRouter></AuthProvider>)
// Node's own experimental localStorage shadows jsdom's; use an in-memory Storage.
function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, String(value)) },
  }
}
beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); state.get.mockReset(); state.post.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('asks the API for a staff-console sign-in and keeps an administrator session', async () => {
  state.post.mockResolvedValue({ user: { id: 'u1', name: 'Staff', email: 's@example.test', role: 'admin' }, tokens })
  guarded('/login')
  await act(() => auth.login('s@example.test', 'pw'))
  expect(state.post).toHaveBeenCalledWith('/auth/login', { email: 's@example.test', password: 'pw', mfaCode: undefined, audience: 'admin' })
  expect(auth.isAuthenticated).toBe(true)
  expect(localStorage.getItem('uf_admin_token')).toBe('access')
})

it('refuses a member account even if the API returns a session, and stores nothing', async () => {
  state.post.mockResolvedValue({ user: { id: 'u2', name: 'Member', email: 'm@example.test', role: 'user' }, tokens })
  guarded('/login')
  await expect(act(() => auth.login('m@example.test', 'pw'))).rejects.toThrow(NO_STAFF_ACCESS)
  expect(auth.isAuthenticated).toBe(false)
  expect(localStorage.getItem('uf_admin_token')).toBeNull()
  expect(localStorage.getItem('uf_admin_user')).toBeNull()
})

it('sends a stored non-administrator session to sign in', () => {
  storeSession('organization')
  guarded()
  expect(screen.getByText('Sign-in page')).toBeVisible()
  expect(screen.queryByText('Console home')).toBeNull()
})

it('lets a stored administrator session into the console', () => {
  storeSession('admin')
  guarded()
  expect(screen.getByText('Console home')).toBeVisible()
})

const prompt = () => render(<AuthProvider><MemoryRouter initialEntries={['/campaigns']}><AdminMfaPrompt /></MemoryRouter></AuthProvider>)

it('keeps reminding an administrator without authenticator sign-in', async () => {
  storeSession('admin')
  state.get.mockResolvedValue({ enabled: false, available: true, recoveryCodesRemaining: 0 })
  prompt()
  expect(await screen.findByText(/turn on authenticator app sign-in/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Turn on' })).toHaveAttribute('href', '/profile?tab=security')
  expect(state.get).toHaveBeenCalledWith('/auth/mfa')
})

it('says when authenticator sign-in is not configured on the server', async () => {
  storeSession('admin')
  state.get.mockResolvedValue({ enabled: false, available: false, recoveryCodesRemaining: 0 })
  prompt()
  expect(await screen.findByText(/not configured on this server/)).toBeVisible()
})

it('shows nothing once MFA is on or when the status cannot be read', async () => {
  storeSession('admin')
  state.get.mockResolvedValue({ enabled: true, available: true, recoveryCodesRemaining: 8 })
  prompt()
  await waitFor(() => expect(state.get).toHaveBeenCalled())
  expect(screen.queryByRole('alert')).toBeNull()
  cleanup()
  state.get.mockReset().mockRejectedValue(new Error('offline'))
  prompt()
  await waitFor(() => expect(state.get).toHaveBeenCalled())
  expect(screen.queryByRole('alert')).toBeNull()
})
