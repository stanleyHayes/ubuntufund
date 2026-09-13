import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import KYCInformationRequests from '@/components/KYCInformationRequests'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/components/auth/PrivateDocumentUpload', () => ({ PrivateDocumentUpload: ({ onChange }: { onChange: (value: string) => void }) => <button onClick={() => onChange('kyc://aaaaaaaaaaaaaaaaaaaaaaaa')}>Upload fixture</button> }))
const exchange = { id: 'request-1', prompt: 'Please clarify the address on your document.', requestedAt: '2026-09-13T00:00:00Z' }
const pending = { verifications: [{ id: 'verification-1', type: 'identity', status: 'in_review', informationRequests: [exchange] }] }
beforeEach(() => vi.resetAllMocks())
const mount = () => render(<ThemeProvider theme={ujimoraTheme}><KYCInformationRequests /></ThemeProvider>)
it('preserves failed response drafts, submits private references, and displays confirmed history', async () => {
  vi.mocked(api.get).mockResolvedValueOnce(pending)
  mount()
  fireEvent.change(await screen.findByLabelText('Your response'), { target: { value: 'This is my current address.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Attach a private document' }))
  expect(screen.getByRole('button', { name: 'Submit response' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Upload fixture' }))
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Response could not be saved.'))
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  expect(await screen.findByText('Response could not be saved.')).toBeInTheDocument()
  expect(screen.getByLabelText('Your response')).toHaveValue('This is my current address.')
  vi.mocked(api.post).mockResolvedValueOnce({ status: 'pending' })
  vi.mocked(api.get).mockResolvedValueOnce({ verifications: [{ ...pending.verifications[0], status: 'pending', informationRequests: [{ ...exchange, response: 'This is my current address.', respondedAt: '2026-09-13T01:00:00Z' }] }] })
  fireEvent.click(screen.getByRole('button', { name: 'Submit response' }))
  expect(await screen.findByText('Status: pending')).toBeInTheDocument()
  expect(screen.queryByLabelText('Your response')).not.toBeInTheDocument()
  expect(api.post).toHaveBeenLastCalledWith('/kyc/verification-1/respond-info', { requestId: 'request-1', response: 'This is my current address.', documents: [{ type: 'id_card', url: 'kyc://aaaaaaaaaaaaaaaaaaaaaaaa' }] })
})
it('shows a retryable load failure instead of claiming no requests exist', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Requests unavailable.'))
  mount()
  expect(await screen.findByText('Requests unavailable.')).toBeInTheDocument()
  expect(screen.queryByText('No additional information has been requested.')).not.toBeInTheDocument()
  vi.mocked(api.get).mockResolvedValueOnce(pending)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh verification requests' }))
  await waitFor(() => expect(screen.getByLabelText('Your response')).toBeInTheDocument())
})

it('shows the applicant rejection reason and correction guidance even without information requests', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ verifications: [{ id: 'rejected-1', type: 'identity', status: 'rejected', rejectionReason: 'Please upload a readable ID image.' }] })
  mount()
  expect(await screen.findByText('Please upload a readable ID image.')).toBeInTheDocument()
  expect(screen.getByText('Correct your details and submit a new application using the form below.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Your response')).not.toBeInTheDocument()
})
