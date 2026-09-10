import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import SplitProceedsSection from '@/components/SplitProceedsSection'
import RouteErrorPage from '@/components/RouteErrorPage'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
const mount = (node: React.ReactNode) => render(<ThemeProvider theme={ujimoraTheme}>{node}</ThemeProvider>)
describe('campaign recovery', () => {
  it('renders a campaign with no active split without crashing', async () => {
    vi.mocked(api.get).mockImplementation(async path => path.endsWith('/split') ? null : [])
    mount(<SplitProceedsSection campaignId="campaign" />)
    expect(await screen.findByText('No split configured')).toBeInTheDocument()
  })
  it('shows failed requests separately and recovers on retry', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Unavailable'))
    mount(<SplitProceedsSection campaignId="campaign" />)
    await screen.findByText('Split details couldn’t load')
    expect(screen.queryByText('No split configured')).not.toBeInTheDocument()
    vi.mocked(api.get).mockImplementation(async path => path.endsWith('/split') ? null : [])
    fireEvent.click(screen.getByRole('button', { name: 'Retry split details' }))
    await screen.findByText('No split configured')
  })
  it('catches route failures with recovery actions and no public stack trace', async () => {
    const router = createMemoryRouter([{ path: '/', loader: () => { throw new Error('private stack details') }, errorElement: <RouteErrorPage /> }])
    mount(<RouterProvider router={router} />)
    await screen.findByText('Let’s get you back on track')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/')
    expect(screen.queryByText(/private stack details/)).not.toBeInTheDocument()
  })
})
