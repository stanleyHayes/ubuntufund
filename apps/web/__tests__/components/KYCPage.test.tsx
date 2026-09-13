vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'individual', role: 'user' } }) }))
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { KYCPage } from '@/pages/KYCPage'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))
vi.mock('@/components/KYCInformationRequests', () => ({ default: () => null }))
vi.mock('@/lib/seo', () => ({ useSeo: () => {} }))
vi.mock('@ubuntu-fund/ui', async original => ({ ...await original<typeof import('@ubuntu-fund/ui')>(), BrandedDatePicker: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <input aria-label={label} value={value} onChange={event => onChange(event.target.value)} /> }))
vi.mock('country-state-city', () => ({ Country: { getAllCountries: () => [{ name: 'Ghana', isoCode: 'GH' }] }, State: { getStatesOfCountry: () => [] }, City: { getCitiesOfState: () => [] } }))
vi.mock('@/components/auth/PrivateDocumentUpload', () => ({ PrivateDocumentUpload: ({ label, onChange }: { label: string; onChange: (value: string) => void }) => <button onClick={() => onChange(`kyc://${(label === 'Front side' || label === 'Passport photo page' ? 'a' : label === 'Back side' ? 'b' : 'c').repeat(24)}`)}>{label}</button> }))
it.each(['id_card', 'passport', 'drivers_license'])('blocks missing uploads and sends the selected %s document type', async documentType => {
  vi.mocked(api.post).mockReset()
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><KYCPage /></MemoryRouter></ThemeProvider>)
  const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  next()
  expect(screen.getByText('Enter your full name and ID number.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Applicant fixture' } })
  fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-01' } })
  fireEvent.change(screen.getByLabelText(/ID Number/), { target: { value: 'GHA-fixture' } })
  fireEvent.change(screen.getByRole('combobox', { name: /Nationality/ }), { target: { value: 'Ghana' } })
  fireEvent.click(await screen.findByRole('option', { name: 'Ghana' }))
  next(); next()
  expect(screen.getByText('Upload the front and back of your ID.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Front side' }))
  fireEvent.click(screen.getByRole('button', { name: 'Back side' }))
  if (documentType !== 'id_card') {
    fireEvent.mouseDown(screen.getByLabelText('Identity document type'))
    fireEvent.click(screen.getByRole('option', { name: documentType === 'passport' ? 'Passport' : 'Driving licence' }))
    next()
    expect(screen.getByText(documentType === 'passport' ? 'Upload the photo page of your passport.' : 'Upload the front and back of your ID.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: documentType === 'passport' ? 'Passport photo page' : 'Front side' }))
    if (documentType !== 'passport') fireEvent.click(screen.getByRole('button', { name: 'Back side' }))
    else expect(screen.queryByRole('button', { name: 'Back side' })).not.toBeInTheDocument()
  }
  next()
  fireEvent.change(screen.getByRole('combobox', { name: /City \/ Town/ }), { target: { value: 'Accra' } })
  fireEvent.change(screen.getByLabelText(/GhanaPost GPS address/), { target: { value: 'GA-123-4567' } })
  next()
  fireEvent.click(screen.getByRole('button', { name: 'Submit Verification' }))
  expect(screen.getByText('Upload a clear selfie holding your ID.')).toBeInTheDocument()
  expect(api.post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Selfie/ }))
  vi.mocked(api.post).mockResolvedValueOnce({})
  fireEvent.click(screen.getByRole('button', { name: 'Submit Verification' }))
  expect(await screen.findByText('Verification Submitted!')).toBeInTheDocument()
  expect(api.post).toHaveBeenCalledWith('/kyc/identity', expect.objectContaining({ documents: [{ type: documentType, url: `kyc://${'a'.repeat(24)}` }, ...(documentType !== 'passport' ? [{ type: documentType, url: `kyc://${'b'.repeat(24)}` }] : []), { type: 'selfie', url: `kyc://${'c'.repeat(24)}` }] }))
})
