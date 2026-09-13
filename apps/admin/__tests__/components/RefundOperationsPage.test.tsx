// Export authorization/download behavior is covered by exports/ExportMenu.test.tsx.
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), edit: true }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post } }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => state.edit }) }))
import RefundOperationsPage from '@/pages/RefundOperationsPage'
const operation = { id: 'operation-123', intentId: 'contribution-123', campaignId: 'campaign-123', provider: 'paystack', transactionReference: 'payment-123', providerReference: 'refund-123', amount: 200, currency: 'GHS', state: 'reversal_pending', createdAt: '2026-09-12T00:00:00Z' }
const queue = { items: [operation], total: 1, page: 1, pageSize: 25 }
beforeEach(() => { state.get.mockReset().mockResolvedValue(queue); state.post.mockReset().mockResolvedValue({ status: 'REFUNDED' }); state.edit = true })
afterEach(cleanup)

it('shows uncertain provider outcomes without a resend or accounting action', async () => {
  state.get.mockResolvedValue({ ...queue, items: [{ ...operation, state: 'provider_unknown', providerReference: undefined }] })
  render(<RefundOperationsPage />)
  expect(await screen.findByText('Provider outcome unknown')).toBeVisible()
  expect(screen.getByText(/Payment reference: payment-123/)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Finish accounting' })).toBeNull()
  expect(state.post).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Verify provider status' })).toBeDisabled()
})

it('submits a recovered provider ID for verification and does not report pending processing as complete', async () => {
  state.get.mockResolvedValue({ ...queue, items: [{ ...operation, state: 'provider_unknown', providerReference: undefined }] })
  state.post.mockResolvedValue({ status: 'PROCESSING' })
  render(<RefundOperationsPage />)
  fireEvent.change(await screen.findByRole('textbox', { name: 'Provider refund ID' }), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify provider status' }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/refund-operations/operation-123/verify', { providerReference: '123456' }))
  expect(await screen.findByText(/The provider is still processing this refund/)).toBeVisible()
  expect(screen.queryByText(/Local accounting completed/)).toBeNull()
})

it('finishes only local accounting and preserves confirmation when the resolved row leaves the queue', async () => {
  state.get.mockResolvedValueOnce(queue).mockResolvedValue({ ...queue, items: [], total: 0 })
  render(<RefundOperationsPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Finish accounting' }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/refund-operations/operation-123/retry-accounting', {}))
  expect(await screen.findByText('No unresolved refund operations.')).toBeVisible()
  expect(screen.getByText(/Local accounting completed. No additional provider refund/)).toBeVisible()
})

it('keeps an unresolved accounting result visibly under review', async () => {
  state.post.mockResolvedValue({ status: 'PENDING_REVIEW' })
  render(<RefundOperationsPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Finish accounting' }))
  expect(await screen.findByText(/Accounting still needs review/)).toBeVisible()
  expect(screen.getByText('Accounting needs completion')).toBeVisible()
})

it('shows load failures with retry and disables accounting writes for read-only access', async () => {
  state.edit = false
  state.get.mockRejectedValueOnce(new Error('Queue unavailable')).mockResolvedValue(queue)
  render(<RefundOperationsPage />)
  expect(await screen.findByText('Queue unavailable')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh refunds' }))
  expect(await screen.findByRole('button', { name: 'Finish accounting' })).toBeDisabled()
  expect(state.post).not.toHaveBeenCalled()
})
