vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
const rows = vi.hoisted(() => [
  { id: 'd1', campaignId: 'c1', campaignTitle: 'Clinic', donorId: 'u1', donorName: 'Ama', amount: 200, currency: 'GHS', paymentMethod: 'card', isAnonymous: false, createdAt: '2026-09-20T10:00:00Z' },
  { id: 'd2', campaignId: 'c1', campaignTitle: 'Clinic', donorId: 'u2', donorName: 'Kojo', amount: 50, currency: 'GHS', paymentMethod: 'mobile_money', isAnonymous: false, createdAt: '2026-09-20T11:00:00Z' },
  { id: 'd3', campaignId: 'c1', campaignTitle: 'Clinic', donorId: 'u3', donorName: 'Jane', amount: 10, currency: 'USD', paymentMethod: 'card', isAnonymous: false, createdAt: '2026-09-20T12:00:00Z' },
])
vi.mock('@/hooks/useApiData', () => ({ useAdminDonations: () => ({ data: rows, isLoading: false, error: null, retry: vi.fn() }) }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
import DonationsPage from '@/pages/DonationsPage'
import { formatMoney } from '@/lib/money'
afterEach(cleanup)

it('totals each currency separately instead of adding USD into GH₵', () => {
  render(<MemoryRouter><DonationsPage /></MemoryRouter>)
  const summary = screen.getByText(/3 donations ·/)
  expect(summary.textContent).toContain(formatMoney(250, 'GHS'))
  expect(summary.textContent).toContain(formatMoney(10, 'USD'))
  expect(summary.textContent).not.toContain(formatMoney(260, 'GHS'))
})

it('formats amounts in their own currency', () => {
  expect(formatMoney(10, 'USD')).not.toBe(formatMoney(10, 'GHS'))
})
