import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api'

const auth = vi.hoisted(() => ({ user: { id: 'viewer' } as { id: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))
import { ShareCampaignButton } from '@/components/campaigns/ShareCampaignButton'

beforeEach(() => {
  vi.mocked(api.post).mockReset().mockResolvedValue({})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

it('records a web share for a signed-in visitor after the link is copied', async () => {
  auth.user = { id: 'viewer' }
  render(<ShareCampaignButton campaignId="c1" title="Clinic roof" url="https://app.ujimora.com/c/clinic" />)
  fireEvent.click(screen.getByRole('button', { name: 'Share Clinic roof' }))
  fireEvent.click(screen.getByText('Copy link / share on Instagram'))
  expect(await screen.findByText('Campaign link copied')).toBeInTheDocument()
  expect(api.post).toHaveBeenCalledWith('/campaigns/c1/share', { platform: 'web-copy' })
})

it('does not call the account-only endpoint for guests, and a failed record never breaks sharing', async () => {
  auth.user = null
  render(<ShareCampaignButton campaignId="c1" title="Clinic roof" url="https://app.ujimora.com/c/clinic" />)
  fireEvent.click(screen.getByRole('button', { name: 'Share Clinic roof' }))
  fireEvent.click(screen.getByText('WhatsApp'))
  expect(api.post).not.toHaveBeenCalled()
  auth.user = { id: 'viewer' }
  vi.mocked(api.post).mockRejectedValueOnce(new Error('offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Share Clinic roof' }))
  fireEvent.click(await screen.findByText('Copy link / share on Instagram'))
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
  expect(await screen.findByText('Campaign link copied')).toBeInTheDocument()
})
