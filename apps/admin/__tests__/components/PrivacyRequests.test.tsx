import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import PrivacyRequestsPage from '@/pages/PrivacyRequestsPage'
const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, put } }))
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))

it('sends the displayed retention revision and preserves notes on a rejected save', async () => {
  get.mockImplementation(async (path: string) => ({ items: path.startsWith('/admin/data-rights') ? [] : [{ _id: 'request', userId: 'owner', contactEmail: 'fixture@example.com', status: 'review_required', requestedAt: '2026-09-12T12:00:00Z', coreRemovedAt: '2026-09-12T12:01:00Z', mediaUrls: [], reviewNotes: '', nextReviewAt: '2027-09-12T12:00:00Z', revision: 3 }], total: path.startsWith('/admin/data-rights') ? 0 : 1 }))
  put.mockRejectedValue(new Error('Request changed. Refresh before reviewing.'))
  render(<PrivacyRequestsPage />)
  const notes = await screen.findByLabelText('Review evidence and next steps')
  fireEvent.change(notes, { target: { value: 'Reviewed the retention purpose and processor follow-up evidence.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save review and follow-up date' }))
  await screen.findByText('Request changed. Refresh before reviewing.')
  expect(notes).toHaveValue('Reviewed the retention purpose and processor follow-up evidence.')
  await waitFor(() => expect(put).toHaveBeenCalledExactlyOnceWith('/admin/privacy-requests/request/review', {
    revision: 3, reviewNotes: 'Reviewed the retention purpose and processor follow-up evidence.', nextReviewAt: '2027-09-12T23:59:59.000Z',
  }))
  expect(screen.getByRole('button', { name: 'Refresh request' })).toBeEnabled()
})
