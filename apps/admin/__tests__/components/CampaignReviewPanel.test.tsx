import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CampaignReviewPanel from '@/components/CampaignReviewPanel'
import { CampaignCategory, CampaignPriority, CampaignStatus, type Campaign } from '@ubuntu-fund/types'
const state = vi.hoisted(() => ({ user: { id: 'staff' }, get: vi.fn(), put: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, put: state.put } }))
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
const campaign: Campaign = { id: 'campaign', creatorId: 'organizer', title: 'School', description: 'Full school story', currency: 'GHS', goalAmount: 300000, raisedAmount: 20, category: CampaignCategory.EDUCATION, priority: CampaignPriority.NORMAL, status: CampaignStatus.PENDING_REVIEW, beneficiaries: ['School'], imageUrls: ['https://media.example.test/photo.jpg'], startDate: new Date(), endDate: new Date(), createdAt: new Date(), updatedAt: new Date(), reviewVersion: 'a'.repeat(64) }
const reason = 'Reviewed all content and the supporting fundraising evidence.'
beforeEach(() => { vi.clearAllMocks(); state.user = { id: 'staff' }; state.get.mockResolvedValue({ items: [], total: 0 }); state.put.mockResolvedValue({}) })
function fillReview() {
  fireEvent.change(screen.getByLabelText('Decision notes (at least 20 characters)'), { target: { value: reason } })
  fireEvent.click(screen.getByRole('checkbox', { name: /complete public content/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /organizer verification/ }))
}
it('requires the full review and sends the displayed version and notes', async () => {
  const onChanged = vi.fn()
  render(<CampaignReviewPanel campaign={campaign} onChanged={onChanged} />)
  expect(screen.getByRole('button', { name: 'Approve campaign' })).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Open attachment 1' })).toHaveAttribute('href', campaign.imageUrls[0])
  fillReview()
  fireEvent.click(screen.getByRole('button', { name: 'Approve campaign' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  expect(state.put).toHaveBeenCalledExactlyOnceWith('/campaigns/campaign/review', { action: 'approve', reason, expectedVersion: campaign.reviewVersion, contentReviewed: true, fundraisingReviewed: true })
})
it('preserves notes on a version conflict and resets acknowledgements for the new version', async () => {
  const onChanged = vi.fn()
  state.put.mockRejectedValue(new Error('The campaign changed. Reload and review the current version.'))
  const view = render(<CampaignReviewPanel campaign={campaign} onChanged={onChanged} />)
  fillReview(); fireEvent.click(screen.getByRole('button', { name: 'Approve campaign' }))
  await screen.findByText(/The campaign changed/)
  expect(onChanged).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Decision notes (at least 20 characters)')).toHaveValue(reason)
  view.rerender(<CampaignReviewPanel campaign={{ ...campaign, reviewVersion: 'b'.repeat(64) }} onChanged={onChanged} />)
  expect(screen.getByRole('checkbox', { name: /complete public content/ })).not.toBeChecked()
  expect(screen.getByLabelText('Decision notes (at least 20 characters)')).toHaveValue('')
})
it('forbids self-review and prevents an old account response refreshing the new account', async () => {
  const onChanged = vi.fn()
  let finish!: () => void
  state.put.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  const view = render(<CampaignReviewPanel campaign={campaign} onChanged={onChanged} />)
  fillReview(); fireEvent.click(screen.getByRole('button', { name: 'Approve campaign' }))
  state.user = { id: 'organizer' }
  view.rerender(<CampaignReviewPanel campaign={campaign} onChanged={onChanged} />)
  finish()
  await waitFor(() => expect(screen.getByText('Another administrator must review your campaign.')).toBeVisible())
  expect(screen.getByRole('button', { name: 'Approve campaign' })).toBeDisabled()
  expect(onChanged).not.toHaveBeenCalled()
})
