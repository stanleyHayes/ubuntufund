// Export authorization/download behavior is covered by exports/ExportMenu.test.tsx.
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import PublicationReviewsPage from '@/pages/PublicationReviewsPage'
const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, put } }))
it.each([
  { action: 'account.profile', text: JSON.stringify({ name: 'Full proposed content', country: 'Ghana', publicProfile: true }) },
  { action: 'organization.profile', text: JSON.stringify({ organizationName: 'Full proposed content', website: 'https://example.test' }) },
  { action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama', bio: 'Full proposed content', tipsEnabled: false }) },
  { action: 'update.create', text: JSON.stringify(['Update title', 'Full proposed content', 'general']) },
  { action: 'campaign.create', text: JSON.stringify({ title: 'School campaign', description: 'Full proposed content', beneficiaries: ['School community'], goalAmount: 300000, currency: 'GHS' }) },
])('requires notes and approves only the displayed $action version without publishing it', async ({ action, text }) => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'review', actorId: 'author', action, text, mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 })
  put.mockResolvedValue({})
  render(<PublicationReviewsPage />)
  const approve = await screen.findByRole('button', { name: 'Approve this version' })
  expect(approve).toBeDisabled()
  expect(screen.getByText(/Full proposed content/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed the complete proposed public text.' } })
  get.mockResolvedValue({ items: [], total: 0 })
  fireEvent.click(approve)
  await waitFor(() => expect(put).toHaveBeenCalledExactlyOnceWith('/admin/publication-reviews/review/review', { decision: 'approved', notes: 'Reviewed the complete proposed public text.' }))
  expect(await screen.findByText('No submissions in this queue.')).toBeInTheDocument()
})
it('submits the exact supporter content version through the separate payment-content queue', async () => {
  vi.clearAllMocks()
  get.mockImplementation(async path => path.includes('tip-content-reviews') ? { items: [{ id: 'tip', version: 'version-hash', actorId: 'Guest', action: 'tip.public_content', text: JSON.stringify({ supporterName: 'Guest name', message: 'Review this message' }), mediaUrls: [], status: 'pending', reason: 'staff_requested' }], total: 1 } : { items: [], total: 0 })
  put.mockResolvedValue({})
  render(<PublicationReviewsPage />)
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Content queue' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Supporter names and messages' }))
  const approve = await screen.findByRole('button', { name: 'Approve this version' })
  expect(screen.getByText(/Review this message/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed the exact supporter name and message.' } })
  fireEvent.click(approve)
  await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/tip-content-reviews/tip/review', { decision: 'approved', notes: 'Reviewed the exact supporter name and message.', version: 'version-hash' }))
})
it.each([['tip-content-reviews', 'Supporter names and messages'], ['donation-content-reviews', 'Campaign donor names and messages']])('opens %s from the action-center link', async (queue, label) => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [], total: 0 })
  window.history.replaceState({}, '', `/publication-reviews?queue=${queue}`)
  try {
    render(<PublicationReviewsPage />)
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/admin/${queue}?status=pending&page=1`))
    expect(screen.getByRole('combobox', { name: 'Content queue' })).toHaveTextContent(label)
  } finally { window.history.replaceState({}, '', '/') }
})
