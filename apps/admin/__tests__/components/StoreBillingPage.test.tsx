// Export authorization/download behavior is covered by exports/ExportMenu.test.tsx.
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, post } }))
import StoreBillingPage from '@/pages/StoreBillingPage'
const queue = { enabled: true, purchaseTotal: 1, notificationTotal: 0, notifications: [], purchases: [{ _id: 'a'.repeat(64), userId: 'account', store: 'google', productId: 'pro', acknowledgementPending: true, nextCheckAt: '2026-09-12T00:00:00Z' }] }
beforeEach(() => { get.mockReset().mockResolvedValue(queue); post.mockReset().mockResolvedValue({ queued: true }) })
afterEach(cleanup)

it('requires a reason and preserves the queued confirmation after refreshing', async () => {
  render(<StoreBillingPage />)
  const retry = await screen.findByRole('button', { name: 'Queue verification retry' })
  expect(retry).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for retry' }), { target: { value: 'Reviewed store service permissions.' } })
  fireEvent.click(retry)
  await waitFor(() => expect(post).toHaveBeenCalledWith(`/admin/store-billing/purchase/${'a'.repeat(64)}/retry`, { reason: 'Reviewed store service permissions.' }))
  expect(await screen.findByText(/Retry queued. The worker will verify/)).toBeVisible()
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  expect(screen.getByText(/Retry queued. The worker will verify/)).toBeVisible()
  expect(screen.getByText('Acknowledgement pending')).toBeVisible()
})

it('allows inspection but prevents retries when store billing is disabled', async () => {
  get.mockResolvedValue({ ...queue, enabled: false })
  render(<StoreBillingPage />)
  const reason = await screen.findByRole('textbox', { name: 'Reason for retry' })
  fireEvent.change(reason, { target: { value: 'Reviewed store service permissions.' } })
  expect(screen.getByRole('button', { name: 'Queue verification retry' })).toBeDisabled()
  expect(post).not.toHaveBeenCalled()
})
