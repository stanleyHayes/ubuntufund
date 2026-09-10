import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import AiUsagePage from '@/pages/AiUsagePage'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
const stats = {
  enabled: true,
  totalRequests: 2,
  requestsToday: 2,
  requestsThisMonth: 2,
  inputTokens: 42,
  outputTokens: 18,
  errors: 1,
  lastUsedAt: '2026-09-09T12:00:00.000Z',
}
const usage = {
  data: [
    {
      id: 'request1',
      userId: 'creator1',
      userName: 'Campaign Organizer',
      action: 'IMPROVE_CLARITY',
      status: 'success',
      model: 'gpt-4.1-mini',
      inputTokens: 42,
      outputTokens: 18,
      timestamp: '2026-09-09T12:00:00.000Z',
    },
  ],
  pagination: { total: 21, totalPages: 2 },
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.get).mockImplementation(async (path) => (path.includes('/stats') ? stats : usage))
})
const mount = () =>
  render(
    <ThemeProvider theme={ujimoraTheme}>
      <AiUsagePage />
    </ThemeProvider>,
  )
describe('AI usage dashboard', () => {
  it('uses one illustrated empty state', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path.includes('/stats')
        ? { ...stats, lastUsedAt: null }
        : { data: [], pagination: { total: 0, totalPages: 0 } },
    )
    mount()
    await screen.findByText('Your writing activity starts here')
    expect(screen.queryByText('No requests on this page.')).not.toBeInTheDocument()
    expect(screen.queryByText('No writing requests yet.')).not.toBeInTheDocument()
  })

  it('shows real entries and fetches the next page', async () => {
    mount()
    await screen.findByText('Campaign Organizer')
    expect(screen.getByText('gpt-4.1-mini')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))
    await screen.findByText('Campaign Organizer')
    expect(api.get).toHaveBeenCalledWith('/ai-writing/usage?page=2&pageSize=20')
  })
  it('shows failures and offers retry instead of a coming-soon state', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Service unavailable'))
    mount()
    await screen.findByText('Service unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await screen.findByText('Campaign Organizer')
    expect(screen.queryByText('Service unavailable')).not.toBeInTheDocument()
  })
})
