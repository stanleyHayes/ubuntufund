// Export authorization/download behavior is covered by exports/ExportMenu.test.tsx.
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import PublicationReviewsPage from '@/pages/PublicationReviewsPage'
const { get, put, auth } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), auth: { user: { id: 'reviewer' } } }))
vi.mock('@/lib/api', () => ({ api: { get, put } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }))
const photo = 'https://res.cloudinary.com/ujimora/image/upload/v1/avatars/photo.jpg', cover = 'https://res.cloudinary.com/ujimora/image/upload/v1/covers/cover.jpg'
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
    await waitFor(() => expect(get).toHaveBeenCalledWith(`/admin/${queue}?status=pending&page=1&pageSize=12`))
    expect(screen.getByRole('combobox', { name: 'Content queue' })).toHaveTextContent(label)
  } finally { window.history.replaceState({}, '', '/') }
})
it('previews Cloudinary profile media labelled as the proposed photo and cover', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'profile', actorId: 'author', action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama', avatarUrl: photo, coverUrl: cover }), mediaUrls: [cover, photo], status: 'pending', reason: 'staff_requested' }], total: 1 })
  render(<PublicationReviewsPage />)
  expect(await screen.findByAltText('Photo preview')).toHaveAttribute('src', photo)
  expect(screen.getByAltText('Cover preview')).toHaveAttribute('src', cover)
  expect(screen.getByAltText('Photo preview')).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(screen.getByRole('link', { name: 'Open original Cover' })).toHaveAttribute('href', cover)
  expect(screen.queryByText(/^Media \d/)).toBeNull()
})
it('labels one image proposed as both photo and cover', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'profile', actorId: 'author', action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama', avatarUrl: photo, coverUrl: photo }), mediaUrls: [photo, photo], status: 'pending', reason: 'staff_requested' }], total: 1 })
  render(<PublicationReviewsPage />)
  expect(await screen.findAllByAltText('Photo and cover preview')).toHaveLength(2)
  expect(screen.queryByAltText('Photo preview')).toBeNull()
})
it('falls back to numbered labels when the profile text is not structured', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'profile', actorId: 'author', action: 'account.profile', text: 'not json', mediaUrls: [photo], status: 'pending', reason: 'staff_requested' }], total: 1 })
  render(<PublicationReviewsPage />)
  expect(await screen.findByAltText('Media 1 preview')).toHaveAttribute('src', photo)
})
it('does not load media hosted outside Cloudinary', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [{ id: 'comment', actorId: 'author', action: 'comment.create', text: 'Look at this', mediaUrls: ['https://media.example.test/photo.jpg'], status: 'pending', reason: 'staff_requested' }], total: 1 })
  render(<PublicationReviewsPage />)
  expect(await screen.findByText(/not hosted in Ujimora image storage/)).toBeInTheDocument()
  expect(screen.getByText('https://media.example.test/photo.jpg')).toBeInTheDocument()
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.queryByRole('link', { name: /Open original/ })).toBeNull()
})
it('explains and blocks review of the signed-in administrator\'s own pending submission', async () => {
  vi.clearAllMocks()
  get.mockResolvedValue({ items: [
    { id: 'own', actorId: 'reviewer', action: 'comment.create', text: 'My own comment', mediaUrls: [], status: 'pending', reason: 'staff_requested' },
    { id: 'other', actorId: 'author', action: 'comment.create', text: 'Another author comment', mediaUrls: [], status: 'pending', reason: 'staff_requested' },
    { id: 'decided', actorId: 'reviewer', action: 'comment.create', text: 'My decided comment', mediaUrls: [], status: 'approved', reason: 'staff_requested', reviewNotes: 'Reviewed by another administrator.' },
  ], total: 3 })
  put.mockResolvedValue({})
  render(<PublicationReviewsPage />)
  expect(await screen.findByText('You submitted this. Another administrator must review it.')).toBeInTheDocument()
  expect(screen.getAllByText('You submitted this. Another administrator must review it.')).toHaveLength(1)
  const [ownNotes, otherNotes] = screen.getAllByLabelText('Review notes (at least 20 characters)')
  const [ownApprove, otherApprove] = screen.getAllByRole('button', { name: 'Approve this version' })
  const [ownDecline, otherDecline] = screen.getAllByRole('button', { name: 'Decline this version' })
  fireEvent.change(ownNotes, { target: { value: 'Trying to review my own submission.' } })
  fireEvent.change(otherNotes, { target: { value: 'Reviewed the other author comment.' } })
  expect(ownApprove).toBeDisabled()
  expect(ownDecline).toBeDisabled()
  expect(otherApprove).toBeEnabled()
  expect(otherDecline).toBeEnabled()
  fireEvent.click(otherDecline)
  await waitFor(() => expect(put).toHaveBeenCalledExactlyOnceWith('/admin/publication-reviews/other/review', { decision: 'rejected', notes: 'Reviewed the other author comment.' }))
})
