// Export authorization/download behavior is covered by exports/ExportMenu.test.tsx.
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post } }))
import PayoutsPage from '@/pages/PayoutsPage'

const pending = {
  id: 'payout-1', campaignId: 'campaign-1', campaignTitle: 'Clinic roof', recipientId: 'recipient-1',
  amount: 500, type: 'standard', fee: 0, netAmount: 500, currency: 'GHS', status: 'PENDING',
  provider: 'paystack', requestedBy: 'owner-1', createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z',
}
const reason = 'Destination evidence did not match the campaign owner.'
beforeEach(() => {
  state.get.mockReset().mockResolvedValue([pending])
  state.post.mockReset().mockResolvedValue({ ...pending, status: 'FAILED', closure: { kind: 'rejected', reason, closedBy: 'admin', closedAt: '2026-09-21T00:00:00Z' } })
})
afterEach(cleanup)

it('rejects a pending request only with a 20-character reason and reports that nothing was sent', async () => {
  render(<MemoryRouter><PayoutsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Reject request' }))
  const submit = screen.getByRole('button', { name: 'Reject payout' })
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for rejection' }), { target: { value: 'too short' } })
  expect(submit).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for rejection' }), { target: { value: reason } })
  state.get.mockResolvedValue([])
  fireEvent.click(submit)
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/payouts/payout-1/reject', { reason }))
  expect(await screen.findByText(/no transfer was sent/i)).toBeVisible()
})

it('keeps the card and the typed reason when a rejection is refused, and reports it above the list', async () => {
  state.post.mockRejectedValue(new Error('This payout was already approved by another administrator.'))
  render(<MemoryRouter><PayoutsPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Reject request' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for rejection' }), { target: { value: reason } })
  fireEvent.click(screen.getByRole('button', { name: 'Reject payout' }))
  expect(await screen.findByText('This payout was already approved by another administrator.')).toBeVisible()
  expect(screen.queryByText('Payouts couldn’t be loaded')).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Reason for rejection' })).toHaveValue(reason)
})

it('keeps the loaded list when a background refresh fails', async () => {
  render(<MemoryRouter><PayoutsPage /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: 'Reject request' })).toBeVisible()
  state.get.mockRejectedValue(new Error('Network unavailable'))
  window.dispatchEvent(new Event('focus'))
  expect(await screen.findByText(/Network unavailable/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reject request' })).toBeVisible()
  expect(screen.queryByText('Payouts couldn’t be loaded')).toBeNull()
})

it('labels a closed request as rejected and shows the reason', async () => {
  state.get.mockResolvedValue([{ ...pending, status: 'FAILED', closure: { kind: 'rejected', reason, closedBy: 'admin', closedAt: '2026-09-21T00:00:00Z' } }])
  render(<MemoryRouter initialEntries={['/payouts?view=all']}><PayoutsPage /></MemoryRouter>)
  expect(await screen.findByText('Rejected')).toBeVisible()
  expect(screen.getByText(reason)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Reject request' })).toBeNull()
})

it('resolves a stuck single transfer from Paystack only after the admin records what they checked', async () => {
  state.get.mockResolvedValue([{ ...pending, status: 'NEEDS_REVIEW', providerRef: 'pout-payout-1' }])
  state.post.mockResolvedValue({ rail: 'campaign', payoutId: 'payout-1', providerOutcome: 'failed', status: 'FAILED' })
  render(<MemoryRouter><PayoutsPage /></MemoryRouter>)
  const resolve = await screen.findByRole('button', { name: 'Re-check Paystack and resolve' })
  expect(resolve).toBeDisabled()
  expect(screen.queryByText(/Partially settled/)).toBeNull()
  fireEvent.change(screen.getByRole('textbox', { name: 'What you checked' }), { target: { value: 'Paystack shows no transfer for this reference.' } })
  fireEvent.click(resolve)
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/payouts/stuck/campaign/payout-1/resolve', { note: 'Paystack shows no transfer for this reference.' }))
  expect(await screen.findByText(/Paystack reported failed; the payout is now failed/)).toBeVisible()
})

it('lists escalated transfers from every rail and resolves each on its own rail', async () => {
  const creator = { rail: 'creator', id: 'cp-1', amount: 97, currency: 'GHS', providerRef: 'cpay-cp-1', subject: 'user-9', subjectLabel: 'Creator', createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-21T00:00:00Z' }
  const affiliate = { ...creator, rail: 'affiliate', id: 'ap-1', providerRef: 'aff-ap-1', subject: 'aff-1', subjectLabel: 'Affiliate' }
  state.get.mockImplementation(async (path: string) => (path === '/payouts/stuck' ? [creator, affiliate] : []))
  state.post.mockResolvedValue({ rail: 'creator', payoutId: 'cp-1', providerOutcome: 'failed', status: 'FAILED' })
  render(<MemoryRouter initialEntries={['/payouts?view=escalated']}><PayoutsPage /></MemoryRouter>)
  expect(await screen.findByText('Creator withdrawal')).toBeVisible()
  expect(screen.getByText('Affiliate payout')).toBeVisible()
  const [firstNote] = screen.getAllByRole('textbox', { name: 'What you checked' })
  fireEvent.change(firstNote, { target: { value: 'Paystack shows no transfer for this reference.' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Re-check Paystack and resolve' })[0])
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/payouts/stuck/creator/cp-1/resolve', { note: 'Paystack shows no transfer for this reference.' }))
})
