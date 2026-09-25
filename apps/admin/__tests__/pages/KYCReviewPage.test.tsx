import { MemoryRouter } from 'react-router-dom'
import VerificationsPage from '@/pages/VerificationsPage'
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import KYCReviewPage from '@/pages/KYCReviewPage'
import { api } from '@/lib/api'
vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
vi.mock('@/lib/api', () => ({ api: { put: vi.fn() } }))
vi.mock('@/hooks/useApiData', () => ({ useKYCStats: () => stats, useAdminKYCVerifications: () => ({ data: [{ id: 'kyc-test', reviewVersion: 'a'.repeat(64), userName: 'Applicant', userId: 'user', verificationType: 'identity', status: 'pending', riskLevel: 'low', documents: [], createdAt: '2026-09-12T12:00:00Z' }], isLoading: false, error: null }) }))
const stats = vi.hoisted(() => ({ data: { pending: 4, approvedToday: 3, rejectedToday: 2 }, isLoading: false, error: null as string | null, retry: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
const mount = () => render(<ThemeProvider theme={ujimoraTheme}><KYCReviewPage /></ThemeProvider>)
it('preserves pending status on save failure and permits a confirmed retry', async () => {
  vi.mocked(api.put).mockRejectedValueOnce(new Error('Staff access changed.'))
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Review evidence' }))
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Internal review findings'), { target: { value: 'Identity documents reviewed against the application.' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed the application/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  expect((await screen.findAllByText('Staff access changed.')).length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled()
  vi.mocked(api.put).mockResolvedValueOnce({ status: 'approved' })
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument())
  expect(api.put).toHaveBeenCalledTimes(2)
  expect(api.put).toHaveBeenLastCalledWith('/kyc/kyc-test/approve', { reviewVersion: 'a'.repeat(64), evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.' })
})
it('keeps a failed information request editable and changes status only after confirmed save', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Request' }))
  expect(screen.getByRole('button', { name: 'Save request' })).toBeDisabled()
  const prompt = 'Please clarify the address on your document.'
  fireEvent.change(screen.getByLabelText('Information needed'), { target: { value: prompt } })
  vi.mocked(api.put).mockRejectedValueOnce(new Error('Request could not be saved.'))
  fireEvent.click(screen.getByRole('button', { name: 'Save request' }))
  await waitFor(() => expect(screen.getAllByText('Request could not be saved.').length).toBeGreaterThan(0))
  expect(screen.getByLabelText('Information needed')).toHaveValue(prompt)
  vi.mocked(api.put).mockResolvedValueOnce({ id: 'request-1', prompt, requestedAt: '2026-09-13T00:00:00Z' })
  fireEvent.click(screen.getByRole('button', { name: 'Save request' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save request' })).not.toBeInTheDocument())
  expect(api.put).toHaveBeenLastCalledWith('/kyc/kyc-test/request-info', { prompt, reviewVersion: 'a'.repeat(64) })
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  expect(screen.getByText(/Awaiting applicant response/)).toBeInTheDocument()
})

it('routes the alternate page to the full evidence review instead of approving from a summary', () => {
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><VerificationsPage /></MemoryRouter></ThemeProvider>)
  expect(screen.getByRole('link', { name: 'Review evidence' })).toHaveAttribute('href', '/kyc-review?application=kyc-test')
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  expect(api.put).not.toHaveBeenCalled()
})

it.each([KYCReviewPage, VerificationsPage])('requires an applicant reason and retains a rejected-save draft on either review page', async Page => {
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><Page /></MemoryRouter></ThemeProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
  expect(screen.getByRole('button', { name: 'Save rejection' })).toBeDisabled()
  const rejectionReason = 'The ID image is unreadable. Please submit a clearer image.'
  fireEvent.change(screen.getByLabelText('Reason for the applicant'), { target: { value: rejectionReason } })
  vi.mocked(api.put).mockRejectedValueOnce(new Error('Decision unavailable.'))
  fireEvent.click(screen.getByRole('button', { name: 'Save rejection' }))
  expect(await screen.findByText('Decision unavailable.')).toBeInTheDocument()
  expect(screen.getByLabelText('Reason for the applicant')).toHaveValue(rejectionReason)
  vi.mocked(api.put).mockResolvedValueOnce({ status: 'rejected' })
  fireEvent.click(screen.getByRole('button', { name: 'Save rejection' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save rejection' })).not.toBeInTheDocument())
  expect(api.put).toHaveBeenLastCalledWith('/kyc/kyc-test/reject', { reviewVersion: 'a'.repeat(64), rejectionReason })
  expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
})

it('shows server day counts from /kyc/stats and refreshes them after a decision', async () => {
  vi.mocked(api.put).mockResolvedValueOnce({ status: 'approved' })
  mount()
  const header = screen.getByText('Approved today (UTC)').parentElement!
  expect(header).toHaveTextContent('3')
  expect(screen.getByText('Rejected today (UTC)').parentElement!).toHaveTextContent('2')
  expect(screen.getByText('Pending').parentElement!).toHaveTextContent('4')
  fireEvent.click(screen.getByRole('button', { name: 'Review evidence' }))
  fireEvent.change(screen.getByLabelText('Internal review findings'), { target: { value: 'Identity documents reviewed against the application.' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed the application/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(stats.retry).toHaveBeenCalled())
})

it('offers only the statuses the review queue can contain', () => {
  mount()
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status' }))
  const options = screen.getAllByRole('option').map(option => option.getAttribute('data-value'))
  expect(options).toEqual(['all', 'pending', 'in_review'])
})
