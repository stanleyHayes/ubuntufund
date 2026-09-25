import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { CreatorTipPage } from '@/pages/CreatorTipPage'
import { api } from '@/lib/api'

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {
    status = 500
  },
}))
afterEach(() => {
  vi.resetAllMocks()
  auth.user = null
})

const creator = (images: { avatarUrl?: string; coverUrl?: string }) => ({
  userId: 'owner',
  displayName: 'Stanley Hayford',
  handle: 'stanley',
  tipsEnabled: true,
  presetAmounts: [10],
  currency: 'GHS',
  supporterCount: 0,
  totalReceived: 0,
  recentTips: [],
  ...images,
})
function show() {
  return render(
    <MemoryRouter initialEntries={['/creators/stanley']}>
      <Routes>
        <Route path="/creators/:handle" element={<CreatorTipPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('creator page images', () => {
  it('shows the approved cover and photo', async () => {
    auth.user = { id: 'owner' }
    vi.mocked(api.get).mockResolvedValue(
      creator({ avatarUrl: 'https://example.com/avatar.png', coverUrl: 'https://example.com/cover.jpg' }),
    )
    const { container } = show()
    expect(await screen.findByAltText("Stanley Hayford's cover")).toHaveAttribute('src', 'https://example.com/cover.jpg')
    expect(container.querySelector('img[src="https://example.com/avatar.png"]')).not.toBeNull()
    expect(screen.queryByText(/Visitors see the default/)).not.toBeInTheDocument()
  })

  it('tells the owner why the page shows default images and where to add them', async () => {
    auth.user = { id: 'owner' }
    vi.mocked(api.get).mockResolvedValue(creator({}))
    show()
    expect(await screen.findByText(/Visitors see the default photo and cover/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Creator settings' })).toHaveAttribute('href', '/creator')
    expect(screen.queryByAltText("Stanley Hayford's cover")).not.toBeInTheDocument()
  })

  it('names only the missing image for the owner', async () => {
    auth.user = { id: 'owner' }
    vi.mocked(api.get).mockResolvedValue(creator({ avatarUrl: 'https://example.com/avatar.png' }))
    show()
    expect(await screen.findByText(/Visitors see the default cover\./)).toBeInTheDocument()
  })

  it('does not show the owner notice to visitors', async () => {
    auth.user = { id: 'visitor' }
    vi.mocked(api.get).mockResolvedValue(creator({}))
    show()
    expect(await screen.findByRole('heading', { name: 'Stanley Hayford' })).toBeInTheDocument()
    expect(screen.queryByText(/Visitors see the default/)).not.toBeInTheDocument()
  })
})
