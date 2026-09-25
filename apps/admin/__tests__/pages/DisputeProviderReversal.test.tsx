import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post, put: state.put } }))
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import DisputeDetailPage from '@/pages/DisputeDetailPage'

const providerCase = {
  id: 'd1', campaignId: 'c1', campaignTitle: 'Clinic roof', reporterId: 'system:paystack', reporterName: 'Paystack (payment provider)',
  reason: 'Refund issued outside Ujimora', description: 'Paystack processed a refund… Do NOT issue another refund from the console.',
  status: 'open', source: 'paystack', providerCaseKind: 'external_refund', transactionReference: 'uf-abc', donationIntentId: 'i1',
  amount: 220, currency: 'GHS', providerStatus: 'processed', createdAt: '2026-09-24T10:00:00Z', updatedAt: '2026-09-24T10:00:00Z',
}
const renderPage = () => render(
  <MemoryRouter initialEntries={['/disputes/d1']}><Routes><Route path="/disputes/:id" element={<DisputeDetailPage />} /></Routes></MemoryRouter>
)
beforeEach(() => { state.get.mockReset().mockResolvedValue(providerCase); state.post.mockReset(); state.put.mockReset() })
afterEach(cleanup)

// R2-001: staff record the reversal the provider already made — never a console refund.
it('records a provider reversal only after staff confirm the dashboard refund', async () => {
  state.post.mockResolvedValue({ dispute: { ...providerCase, reversalOperationId: 'op-1' }, reversal: { status: 'REFUNDED', operationId: 'op-1', amount: 200 } })
  renderPage()
  expect(await screen.findByText(/Do not refund this donation from Payments/)).toBeVisible()
  expect(screen.getByText('GHS 220.00')).toBeVisible()
  const record = screen.getByRole('button', { name: 'Record provider reversal' })
  expect(record).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /returned to the donor/ }))
  fireEvent.click(record)
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/disputes/d1/provider-reversal', {}))
  expect(await screen.findByText(/The reversal is recorded \(operation op-1\)/)).toBeVisible()
})

it('sends an explicit campaign amount when staff enter one', async () => {
  state.post.mockResolvedValue({ dispute: { reversalOperationId: 'op-2' }, reversal: { status: 'PARTIALLY_REFUNDED', operationId: 'op-2', amount: 50 } })
  renderPage()
  fireEvent.change(await screen.findByRole('textbox', { name: /Campaign amount to reverse/ }), { target: { value: '50' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /returned to the donor/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Record provider reversal' }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/disputes/d1/provider-reversal', { amount: 50 }))
})

it('shows no reversal action on a staff-raised dispute', async () => {
  state.get.mockResolvedValue({ ...providerCase, source: 'staff', providerCaseKind: undefined, reporterId: 'u1', reporterName: 'Ama' })
  renderPage()
  expect(await screen.findByText('Ama')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Record provider reversal' })).toBeNull()
})
