import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CampaignCategory, CampaignPriority, CampaignStatus, type Campaign } from '@ubuntu-fund/types'
import { campaignSearchPath } from '@/hooks/useCampaigns'
import { api } from '@/lib/api'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))

import { ExplorePage } from '@/pages/ExplorePage'

function campaign(id: string, title: string): Campaign {
  return {
    id, title, description: 'A campaign description', goalAmount: 1000, raisedAmount: 100, currency: 'GHS',
    category: CampaignCategory.MEDICAL, priority: CampaignPriority.NORMAL, status: CampaignStatus.ACTIVE,
    creatorId: 'creator', beneficiaries: [], imageUrls: [], startDate: new Date('2025-01-01'),
    endDate: new Date(Date.now() + 86_400_000), createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'),
  }
}

function paths(): URL[] {
  return vi.mocked(api.get).mock.calls.map(([path]) => new URL(String(path), 'https://app.test'))
}

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    const url = new URL(path, 'https://app.test')
    if (url.searchParams.get('q') === 'Oldest') return { items: [campaign('old', 'Oldest clinic roof')], total: 1, page: 1, pageSize: 6, totalPages: 1 }
    return { items: [campaign('new', 'Newest school books')], total: 40, page: Number(url.searchParams.get('page')), pageSize: 6, totalPages: 7 }
  })
})

function renderPage() {
  return render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><ExplorePage /></MemoryRouter></ThemeProvider>)
}

it('builds bounded server queries for search, filters, sort and page', () => {
  expect(campaignSearchPath({ q: '  water  ', category: CampaignCategory.MEDICAL, status: CampaignStatus.EXPIRED, sortBy: 'fundedPercent', sortOrder: 'desc', page: 2, pageSize: 6 }))
    .toBe('/campaigns?page=2&pageSize=6&q=water&category=medical&status=expired&sortBy=fundedPercent&sortOrder=desc')
  expect(campaignSearchPath({ q: 'x'.repeat(150), page: 1, pageSize: 6 })).toContain(`q=${'x'.repeat(100)}&`.slice(0, -1))
  expect(campaignSearchPath({ q: '', category: null, status: null, page: 1, pageSize: 6 })).toBe('/campaigns?page=1&pageSize=6')
})

it('asks the server for the search so a campaign beyond the first page is found', async () => {
  renderPage()
  expect(await screen.findByText('Newest school books')).toBeInTheDocument()
  expect(screen.getByText('40')).toBeInTheDocument()
  expect(paths()[0].searchParams.get('sortBy')).toBe('fundedPercent')

  fireEvent.change(screen.getByLabelText('Find a campaign'), { target: { value: 'Oldest' } })
  expect(await screen.findByText('Oldest clinic roof')).toBeInTheDocument()
  const last = paths().at(-1)!
  expect(last.searchParams.get('q')).toBe('Oldest')
  expect(last.searchParams.get('page')).toBe('1')
})

it('sends category and effective-status filters and pages on the server', async () => {
  renderPage()
  await screen.findByText('Newest school books')
  fireEvent.click(screen.getByRole('button', { name: /Medical/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Expired' }))
  await waitFor(() => {
    const last = paths().at(-1)!
    expect(last.searchParams.get('category')).toBe('medical')
    expect(last.searchParams.get('status')).toBe('expired')
  })
  expect(screen.queryByRole('button', { name: 'Pending Review' })).not.toBeInTheDocument()

  fireEvent.click(await screen.findByRole('button', { name: 'Page 7' }))
  await waitFor(() => expect(paths().at(-1)!.searchParams.get('page')).toBe('7'))
})
