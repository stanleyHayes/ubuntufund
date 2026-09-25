import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

const auth = vi.hoisted(() => ({ user: { id: 'visitor', role: 'user' } as { id: string; role: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))
import { OrganizationProfilePage } from '@/pages/OrganizationProfilePage'

const org = {
  id: 'org-1', name: 'Tamale Water Trust', slug: 'tamale-water-trust', country: 'Ghana', verified: true, createdAt: '2025-01-01T00:00:00Z',
  description: '', logoUrl: '', coverUrl: '', city: '', founded: 2025, impactStatement: 'Tamale Water Trust is an organization on Ujimora.',
  campaignCount: 2, totalRaised: 500, currency: 'GHS', followerCount: 0, categories: [],
}
beforeEach(() => {
  auth.user = { id: 'visitor', role: 'user' }
  vi.mocked(api.get).mockReset().mockImplementation(async (path: string) => path.endsWith('/campaigns') ? [] : org)
})

function renderPage() {
  return render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter initialEntries={['/organizations/tamale-water-trust']}><Routes><Route path="/organizations/:slug" element={<OrganizationProfilePage />} /></Routes></MemoryRouter></ThemeProvider>)
}

it('offers report and block like the native profile, and no Follow that nothing saves', async () => {
  renderPage()
  expect(await screen.findByRole('heading', { name: 'Tamale Water Trust' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Block user' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Followers')).not.toBeInTheDocument()
})
