import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import CryptoOperations from '@/components/payments/CryptoOperations'
import type { ExportReport } from '@/lib/exports/report'

const { get, post, reports } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), reports: [] as ExportReport[] }))
vi.mock('@/lib/api', () => ({ api: { get, post } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }))
vi.mock('@/components/ExportMenu', () => ({ default: ({ getReport }: { getReport: () => ExportReport }) => <button onClick={() => reports.push(getReport())}>Capture report</button> }))

it('shows actionable blocked deposits and includes only explicit issue fields in exports', async () => {
  get.mockResolvedValue({ enabled: false, assets: [] })
  post.mockResolvedValue({ scanned: 2, settled: 0, detected: 0, failed: 0, pending: 0, errored: 0, blocked: 2, issues: [
    { donationIntentId: 'missing-deposit', provider: 'bitnob', reason: 'missing_reference', donorEmail: 'private@example.com' },
    { donationIntentId: 'provider-deposit', provider: 'removed-provider', reason: 'provider_unavailable' },
  ] })
  render(<CryptoOperations />)
  await screen.findByText('No crypto currencies are currently available to contributors.')
  fireEvent.click(screen.getByRole('button', { name: 'Reconcile deposits' }))
  await screen.findByText('missing-deposit')
  expect(screen.getByText('bitnob · Missing provider reference')).toBeInTheDocument()
  expect(screen.getByText('removed-provider · Provider unavailable')).toBeInTheDocument()
  expect(screen.queryByText('private@example.com')).not.toBeInTheDocument()
  await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/crypto/reconcile', { olderThanMinutes: 30 }))
  fireEvent.click(screen.getByRole('button', { name: 'Capture report' }))
  const table = reports.at(-1)!.tables.find(table => table.title === 'Deposits requiring investigation')!
  expect(table.rows).toEqual([
    ['missing-deposit', 'bitnob', 'Missing provider reference'],
    ['provider-deposit', 'removed-provider', 'Provider unavailable'],
  ])
  expect(JSON.stringify(reports)).not.toContain('private@example.com')
})
