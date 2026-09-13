// Export authorization/download behavior is covered by exports/ExportMenu.test.tsx.
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { fireEvent, render, screen } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import SafetyReportsPage from '@/pages/SafetyReportsPage'
const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, put } }))
it('requires evidence before hiding a guest message and does not offer an account restriction for it', async () => {
  get.mockResolvedValue({ items: [{ _id: 'report', targetType: 'donation_message', targetId: 'donation', reason: 'spam', priority: 'normal', status: 'pending', evidence: 'Reported message', createdAt: '2026-09-12T00:00:00Z' }], total: 1, pendingLiveCleanup: 0 })
  put.mockResolvedValue({})
  render(<SafetyReportsPage />)
  const hide = await screen.findByRole('button', { name: 'Hide message' })
  expect(hide).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed the message and confirmed abusive content.' } })
  expect(screen.getByRole('button', { name: 'Restrict publishing' })).toBeDisabled()
  get.mockResolvedValue({ items: [], total: 0, pendingLiveCleanup: 0 })
  fireEvent.click(hide)
  expect(await screen.findByText('Review saved.')).toBeInTheDocument()
  expect(put).toHaveBeenCalledExactlyOnceWith('/admin/safety-reports/report/review', { action: 'hide_message', notes: 'Reviewed the message and confirmed abusive content.' })
})

it('sends the campaign-update hide action with staff review notes', async () => {
  get.mockReset().mockResolvedValue({ items: [{ _id: 'update-report', targetType: 'campaign_update', targetId: 'update', targetUserId: 'author', reason: 'spam', priority: 'normal', status: 'pending', evidence: 'Reported update snapshot', createdAt: '2026-09-12T00:00:00Z' }], total: 1, pendingLiveCleanup: 0 })
  put.mockReset().mockResolvedValue({})
  render(<SafetyReportsPage />)
  const hide = await screen.findByRole('button', { name: 'Hide campaign update' })
  expect(hide).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Review notes (at least 20 characters)'), { target: { value: 'Reviewed the reported update and confirmed it violates the content policy.' } })
  get.mockResolvedValue({ items: [], total: 0, pendingLiveCleanup: 0 })
  fireEvent.click(hide)
  expect(await screen.findByText('Review saved.')).toBeInTheDocument()
  expect(put).toHaveBeenCalledExactlyOnceWith('/admin/safety-reports/update-report/review', { action: 'hide_update', notes: 'Reviewed the reported update and confirmed it violates the content policy.' })
})
