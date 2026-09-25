vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import SafetyReportsPage from '@/pages/SafetyReportsPage'
const { get, put, post } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, put, post } }))
const liftNotes = 'Appeal reviewed and the restriction is no longer needed.'
beforeEach(() => { get.mockReset(); put.mockReset(); post.mockReset() })

it('lists restricted accounts, restricts one directly and lifts a restriction with notes', async () => {
  get.mockImplementation(async (path: string) => path.startsWith('/admin/safety-reports/restrictions')
    ? { items: [{ userId: 'u1', name: 'Kofi', email: 'kofi@example.test', reason: 'Repeated harassment', restrictedBy: 'staff', restrictedAt: '2026-09-20T00:00:00Z' }], total: 1 }
    : { items: [], total: 0, pendingLiveCleanup: 0 })
  post.mockResolvedValue({})
  render(<SafetyReportsPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Restricted users' }))
  expect(await screen.findByText('Kofi')).toBeInTheDocument()
  expect(screen.getByText('Repeated harassment')).toBeInTheDocument()

  const lift = screen.getByRole('button', { name: 'Lift restriction' })
  expect(lift).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Notes for lifting (at least 20 characters)'), { target: { value: liftNotes } })
  fireEvent.click(lift)
  await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/safety-reports/restrictions/u1/restore', { notes: liftNotes }))

  fireEvent.change(screen.getByLabelText('Account ID'), { target: { value: '64b000000000000000000001' } })
  fireEvent.change(screen.getByLabelText('Restriction notes (at least 20 characters)'), { target: { value: 'Direct restriction after repeated abuse.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Restrict publishing' }))
  await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/safety-reports/restrictions/64b000000000000000000001', { notes: 'Direct restriction after repeated abuse.' }))
})

it('restores from a report by its id and only lifts a newer restriction after an explicit confirmation', async () => {
  get.mockResolvedValue({ items: [{ _id: 'old-report', targetType: 'user', targetId: 'u1', targetUserId: 'u1', reason: 'harassment', priority: 'normal', status: 'resolved', resolution: 'restrict_user', reviewNotes: 'Original restriction decision notes.', evidence: 'Kofi', createdAt: '2026-09-12T00:00:00Z' }], total: 1, pendingLiveCleanup: 0 })
  post.mockRejectedValueOnce(new Error('The current restriction came from a different decision. Review it and confirm before lifting it.')).mockResolvedValueOnce({})
  render(<SafetyReportsPage />)
  fireEvent.change(await screen.findByLabelText('Review notes (at least 20 characters)'), { target: { value: liftNotes } })
  fireEvent.click(screen.getByRole('button', { name: 'Restore publishing after appeal' }))
  expect(await screen.findByText(/came from a different decision/)).toBeInTheDocument()
  expect(post).toHaveBeenLastCalledWith('/admin/safety-reports/restrictions/u1/restore', { notes: liftNotes, reportId: 'old-report' })
  fireEvent.click(screen.getByRole('button', { name: 'Lift the current restriction anyway' }))
  await waitFor(() => expect(post).toHaveBeenLastCalledWith('/admin/safety-reports/restrictions/u1/restore', { notes: liftNotes, reportId: 'old-report', confirmSupersede: true }))
})
