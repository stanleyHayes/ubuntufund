// Export authorization/download behavior is covered by exports/ExportMenu.test.tsx.
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post, put: state.put } }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
import AffiliatesPage from '@/pages/AffiliatesPage'
afterEach(cleanup)

const affiliate = { id: 'aff-1', userId: 'user-1', userName: 'Ama Affiliate', referralCode: 'AMA', status: 'active', commissionRate: 10, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }
const payout = { id: 'ap-1', affiliateId: 'aff-1', amount: 30, currency: 'GHS', status: 'PENDING', provider: 'paystack', requestedBy: 'user-1', createdAt: '2026-09-20T00:00:00Z', updatedAt: '2026-09-20T00:00:00Z' }

it('rejects a pending affiliate payout only with a recorded reason', async () => {
  state.get.mockImplementation(async (path: string) => (path === '/affiliates/payouts' ? [payout] : [affiliate]))
  state.post.mockResolvedValue({ ...payout, status: 'FAILED' })
  render(<MemoryRouter><AffiliatesPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('tab', { name: /Payout Queue/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))
  const dialog = await screen.findByRole('dialog', { name: 'Reject affiliate payout?' })
  const submit = within(dialog).getByRole('button', { name: 'Reject payout' })
  expect(submit).toBeDisabled()
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Reason for rejection' }), { target: { value: 'Destination is not in the affiliate’s own name.' } })
  fireEvent.click(submit)
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/affiliates/payouts/ap-1/reject', { reason: 'Destination is not in the affiliate’s own name.' }))
  expect(await screen.findByText(/back in the affiliate’s available balance/)).toBeVisible()
})

it('points an escalated affiliate payout to the resolve view instead of offering approval', async () => {
  state.get.mockImplementation(async (path: string) => (path === '/affiliates/payouts' ? [{ ...payout, status: 'NEEDS_REVIEW', providerRef: 'aff-ap-1-x' }] : [affiliate]))
  render(<MemoryRouter><AffiliatesPage /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('tab', { name: /Payout Queue/ }))
  expect(await screen.findByRole('button', { name: 'Resolve in Payouts' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
})
