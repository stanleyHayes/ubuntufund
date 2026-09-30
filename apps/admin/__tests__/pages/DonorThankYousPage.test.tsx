vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdminDonorThankYou } from '@/pages/DonorThankYousPage'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), canUpdate: true }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post } }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: (_: string, action: string) => action === 'read' || state.canUpdate }) }))
import DonorThankYousPage from '@/pages/DonorThankYousPage'

const partial: AdminDonorThankYou = {
  id: 't1', campaignId: 'c1', campaignTitle: 'Surgery for Ama', status: 'partially_sent', authorRole: 'beneficiary',
  subject: 'Thank you from Ama', body: 'Your gifts paid for my surgery.', signature: 'Ama',
  recipientCount: 40, sentCount: 35, failedCount: 3, skippedCount: 2, retryableCount: 2,
  submittedAt: '2026-09-28T09:00:00.000Z', completedAt: '2026-09-28T09:05:00.000Z', updatedAt: '2026-09-28T09:05:00.000Z',
}
const sent: AdminDonorThankYou = {
  ...partial, id: 't2', campaignId: 'c2', campaignTitle: 'Roof for the clinic', status: 'sent', authorRole: 'manager',
  subject: 'The roof is done', recipientCount: 10, sentCount: 10, failedCount: 0, skippedCount: 0, retryableCount: 0,
}
const sending: AdminDonorThankYou = {
  ...partial, id: 't3', campaignId: 'c3', campaignTitle: 'Books for Tamale', status: 'sending', retryableCount: 1, completedAt: undefined,
}

const renderPage = () => render(<MemoryRouter><DonorThankYousPage /></MemoryRouter>)
beforeEach(() => {
  vi.clearAllMocks()
  state.canUpdate = true
  state.get.mockResolvedValue({ items: [partial, sent, sending], total: 3, page: 1, pageSize: 12 })
  state.post.mockResolvedValue({ requeued: 2 })
})
afterEach(cleanup)

it('lists delivery counts and status for each message without any recipient', async () => {
  renderPage()
  const card = await screen.findByRole('article', { name: 'Thank-you message for Surgery for Ama' })
  expect(state.get).toHaveBeenCalledWith('/admin/donor-thank-yous?status=all&page=1&pageSize=12')
  expect(within(card).getByRole('link', { name: 'Surgery for Ama' })).toHaveAttribute('href', '/campaigns/c1')
  expect(within(card).getByText('Partly sent')).toBeVisible()
  expect(within(card).getByText(/Written by: Beneficiary/)).toBeVisible()
  expect(within(card).getByText('Subject: Thank you from Ama')).toBeVisible()
  for (const [label, value] of [['Recipients', '40'], ['Sent', '35'], ['Skipped', '2'], ['Failed', '3'], ['Can retry', '2']]) {
    expect(within(card).getByText(label).nextElementSibling).toHaveTextContent(value)
  }
  expect(within(card).getByRole('button', { name: 'Retry failed deliveries' })).toBeEnabled()

  const done = screen.getByRole('article', { name: 'Thank-you message for Roof for the clinic' })
  expect(within(done).getByText(/Written by: Organizer team/)).toBeVisible()
  expect(within(done).queryByRole('button', { name: 'Retry failed deliveries' })).toBeNull()

  // A message still sending is left to the delivery worker.
  const inFlight = screen.getByRole('article', { name: 'Thank-you message for Books for Tamale' })
  expect(within(inFlight).queryByRole('button', { name: 'Retry failed deliveries' })).toBeNull()
  expect(within(inFlight).getByText(/once this message finishes sending/)).toBeVisible()

  expect(screen.getByText(/never says who received a message/)).toBeVisible()
  expect(document.body.textContent).not.toMatch(/@/)
})

it('retries only the failed deliveries and reloads the list', async () => {
  renderPage()
  const card = await screen.findByRole('article', { name: 'Thank-you message for Surgery for Ama' })
  fireEvent.click(within(card).getByRole('button', { name: 'Retry failed deliveries' }))
  await waitFor(() => expect(state.post).toHaveBeenCalledExactlyOnceWith('/admin/donor-thank-yous/t1/retry'))
  expect(await screen.findByText(/2 failed deliveries of the thank-you for “Surgery for Ama” will be sent again/)).toBeVisible()
  await waitFor(() => expect(state.get).toHaveBeenCalledTimes(2))
})

it('shows why a retry was refused', async () => {
  state.post.mockRejectedValueOnce(new Error('Only a message with failed deliveries can be retried.'))
  renderPage()
  const card = await screen.findByRole('article', { name: 'Thank-you message for Surgery for Ama' })
  fireEvent.click(within(card).getByRole('button', { name: 'Retry failed deliveries' }))
  expect(await screen.findByText('Only a message with failed deliveries can be retried.')).toBeVisible()
})

it('filters by delivery status and starts again from the first page', async () => {
  renderPage()
  await screen.findByRole('article', { name: 'Thank-you message for Surgery for Ama' })
  state.get.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 })
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Delivery status' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Failed' }))
  await waitFor(() => expect(state.get).toHaveBeenLastCalledWith('/admin/donor-thank-yous?status=failed&page=1&pageSize=12'))
  expect(await screen.findByText('No thank-you messages in this view.')).toBeVisible()
})

it('keeps the retry disabled for read-only staff', async () => {
  state.canUpdate = false
  renderPage()
  const card = await screen.findByRole('article', { name: 'Thank-you message for Surgery for Ama' })
  expect(within(card).getByRole('button', { name: 'Retry failed deliveries' })).toBeDisabled()
})

it('offers a retry when the list cannot load', async () => {
  state.get.mockRejectedValueOnce(new Error('Thank-you service unavailable'))
  renderPage()
  expect(await screen.findByText('Thank-you service unavailable')).toBeVisible()
  expect(screen.queryByText('No thank-you messages in this view.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('article', { name: 'Thank-you message for Surgery for Ama' })).toBeVisible()
})
