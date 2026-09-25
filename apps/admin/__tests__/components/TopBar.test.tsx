import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(async () => ({ count: 0, items: [] })), post: vi.fn(), patch: vi.fn() } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'a1', name: 'Staff Member', email: 's@example.test', role: 'admin' }, logout: vi.fn() }) }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ roleName: 'Administrator', can: () => true }) }))
import TopBar from '@/components/layout/TopBar'
afterEach(cleanup)

it('does not offer a search box that cannot search', () => {
  render(<MemoryRouter><TopBar onReplayTour={vi.fn()} /></MemoryRouter>)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByPlaceholderText(/Search/)).toBeNull()
  expect(document.querySelector('[data-tour="search"]')).toBeNull()
})
