vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), edit: true }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, put: state.put } }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: (_: string, action: string) => action === 'read' || state.edit }) }))
import CampaignReportsPage from '@/pages/CampaignReportsPage'

const report = {
  id: 'report-1', campaignId: 'campaign-1', campaignTitle: 'School roof appeal', campaignStatus: 'active',
  reporterId: 'reporter-1', reason: 'fraudulent', description: 'The photos are copied from another appeal.',
  status: 'pending', createdAt: '2026-09-20T10:00:00Z',
}
const NOTE = 'Verified the photos are stolen; campaign blocked.'
const renderPage = () => render(<MemoryRouter><CampaignReportsPage /></MemoryRouter>)
beforeEach(() => {
  state.get.mockReset().mockResolvedValue({ items: [report], total: 1 })
  state.put.mockReset().mockResolvedValue({})
  state.edit = true
})
afterEach(cleanup)

it('lists pending campaign reports with a link to the campaign', async () => {
  renderPage()
  expect(await screen.findByRole('link', { name: 'School roof appeal' })).toHaveAttribute('href', '/campaigns/campaign-1')
  expect(state.get).toHaveBeenCalledWith('/reports?status=pending&page=1&pageSize=12')
  expect(screen.getByText('Fraudulent activity')).toBeVisible()
  expect(screen.getByText(report.description)).toBeVisible()
})

it('requires a review note before a decision and sends it with the status', async () => {
  state.get.mockResolvedValueOnce({ items: [report], total: 1 }).mockResolvedValue({ items: [], total: 0 })
  const refreshed = vi.fn()
  window.addEventListener('ujimora:admin-actions-changed', refreshed)
  renderPage()
  const markReviewed = await screen.findByRole('button', { name: 'Mark reviewed' })
  expect(markReviewed).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: /Review notes/ }), { target: { value: 'too short' } })
  expect(markReviewed).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: /Review notes/ }), { target: { value: NOTE } })
  fireEvent.click(markReviewed)
  await waitFor(() => expect(state.put).toHaveBeenCalledWith('/reports/report-1/review', { status: 'reviewed', notes: NOTE }))
  expect(await screen.findByText('Report marked reviewed.')).toBeVisible()
  expect(refreshed).toHaveBeenCalled()
  window.removeEventListener('ujimora:admin-actions-changed', refreshed)
})

it('shows decided reports with their review notes and no decision buttons', async () => {
  state.get.mockResolvedValue({ items: [{ ...report, status: 'dismissed', reviewNotes: 'Duplicate of an earlier report.', reviewedBy: 'admin-1', reviewedAt: '2026-09-21T10:00:00Z' }], total: 1 })
  renderPage()
  expect(await screen.findByText('Duplicate of an earlier report.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
})

it('shows a load error with retry instead of an empty queue', async () => {
  state.get.mockRejectedValueOnce(new Error('Reports unavailable')).mockResolvedValue({ items: [report], total: 1 })
  renderPage()
  expect(await screen.findByText('Reports unavailable')).toBeVisible()
  expect(screen.queryByText('No campaign reports in this queue.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('link', { name: 'School roof appeal' })).toBeVisible()
})

it('keeps decisions disabled for read-only staff', async () => {
  state.edit = false
  renderPage()
  fireEvent.change(await screen.findByRole('textbox', { name: /Review notes/ }), { target: { value: NOTE } })
  expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled()
})

it('labels every reason supporters can send, including intellectual property and privacy', async () => {
  state.get.mockResolvedValue({ items: [
    { ...report, id: 'report-ip', reason: 'intellectual_property' },
    { ...report, id: 'report-privacy', reason: 'privacy' },
    { ...report, id: 'report-legacy', reason: 'legacy_reason' },
  ], total: 3 })
  renderPage()
  expect(await screen.findByText('Intellectual property or copyright')).toBeVisible()
  expect(screen.getByText('Privacy violation')).toBeVisible()
  expect(screen.queryByText('intellectual_property')).toBeNull()
  expect(screen.queryByText('privacy')).toBeNull()
  // A value the page does not know is still shown rather than hidden.
  expect(screen.getByText('legacy_reason')).toBeVisible()
  expect(screen.getByText('Privacy violation').closest('.MuiChip-root')).toHaveClass('MuiChip-colorError')
})
