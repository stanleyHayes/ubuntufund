vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post } }))
import PayoutsPage from '@/pages/PayoutsPage'

const NOTE = 'Called the beneficiary; wallet name and tier confirmed.'
const payout = { id: 'bp-1', campaignId: 'campaign-1', beneficiaryId: 'ben-1', recipientId: 'rcp-1', amount: 150, currency: 'GHS', status: 'PENDING', provider: 'paystack', requestedBy: 'ben-1', createdAt: '2026-09-20T10:00:00Z', updatedAt: '2026-09-20T10:00:00Z' }
const destination = { type: 'mobile_money', accountName: 'Ama Mensah', accountNumber: '0551234567', bankCode: 'MTN', currency: 'GHS', kycVerified: true, kycVerifiedBy: 'admin-1', kycVerifiedAt: '2026-09-19T10:00:00Z' }
const renderPage = () => render(<MemoryRouter initialEntries={['/payouts?view=beneficiary']}><PayoutsPage /></MemoryRouter>)
beforeEach(() => {
  state.get.mockReset().mockImplementation(async (path: string) => path.endsWith('/recipient') ? destination : [payout])
  state.post.mockReset().mockResolvedValue({ ...payout, status: 'PROCESSING' })
})
afterEach(cleanup)

it('keeps Approve disabled until the destination is reviewed and a note is written, then sends the note', async () => {
  renderPage()
  const approve = await screen.findByRole('button', { name: 'Approve' })
  expect(approve).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Review payout destination' }))
  expect(await screen.findByText(/0551234567/)).toBeVisible()
  expect(state.get).toHaveBeenCalledWith('/beneficiary-payouts/bp-1/recipient')
  expect(approve).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: 'Beneficiary destination review' }), { target: { value: 'too short' } })
  expect(approve).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: 'Beneficiary destination review' }), { target: { value: NOTE } })
  fireEvent.click(approve)
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/beneficiary-payouts/bp-1/approve', { reviewNote: NOTE }))
})

it('offers KYC verification only after the destination is shown, and blocks approval until verified', async () => {
  let verified = false
  state.get.mockImplementation(async (path: string) => path.endsWith('/recipient') ? { ...destination, kycVerified: verified } : [payout])
  state.post.mockImplementation(async (path: string) => { if (path.endsWith('/verify-kyc')) verified = true; return {} })
  renderPage()
  await screen.findByRole('button', { name: 'Approve' })
  expect(screen.queryByRole('button', { name: 'Verify KYC' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Review payout destination' }))
  expect(await screen.findByText(/KYC is not verified/)).toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: 'Beneficiary destination review' }), { target: { value: NOTE } })
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Verify KYC' }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/campaigns/campaign-1/split/beneficiaries/ben-1/verify-kyc', {}))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled())
})

it('shows a replaced destination as an error instead of approving', async () => {
  state.get.mockImplementation(async (path: string) => { if (path.endsWith('/recipient')) throw new Error('Payout destination was replaced; create a new payout request.'); return [payout] })
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Review payout destination' }))
  expect(await screen.findByText(/destination was replaced/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
})

it('rejects a pending beneficiary request only with a 20-character reason', async () => {
  state.post.mockResolvedValue({ ...payout, status: 'FAILED', closure: { kind: 'rejected', reason: 'x', closedBy: 'admin', closedAt: '2026-09-21T00:00:00Z' } })
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Reject request' }))
  const submit = screen.getByRole('button', { name: 'Reject payout' })
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for rejection' }), { target: { value: 'too short' } })
  expect(submit).toBeDisabled()
  const reason = 'Wallet owner does not match the beneficiary on the split.'
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for rejection' }), { target: { value: reason } })
  fireEvent.click(submit)
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/beneficiary-payouts/bp-1/reject', { reason }))
  expect(await screen.findByText(/no transfer was sent/i)).toBeVisible()
})

it('resolves an escalated beneficiary transfer on the beneficiary rail', async () => {
  state.get.mockImplementation(async (path: string) => path === '/payouts/stuck' ? [] : [{ ...payout, status: 'NEEDS_REVIEW', providerRef: 'bpay-bp-1-x' }])
  state.post.mockResolvedValue({ rail: 'beneficiary', payoutId: 'bp-1', providerOutcome: 'failed', status: 'FAILED' })
  renderPage()
  fireEvent.change(await screen.findByRole('textbox', { name: 'What you checked' }), { target: { value: 'Paystack shows no transfer for this reference.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Re-check Paystack and resolve' }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/payouts/stuck/beneficiary/bp-1/resolve', { note: 'Paystack shows no transfer for this reference.' }))
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
})
