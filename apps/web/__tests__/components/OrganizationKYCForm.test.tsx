import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { fieldHelpLabel, ORGANIZATION_KYC_FIELD_HELP, ORGANIZATION_KYC_HELP_FIELDS } from '@ubuntu-fund/types'
import OrganizationKYCForm from '@/components/OrganizationKYCForm'
import { api } from '@/lib/api'
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }))
vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))
vi.mock('@/components/KYCInformationRequests', () => ({ default: () => <div>Verification history</div> }))
vi.mock('@/components/auth/PrivateDocumentUpload', () => ({ PrivateDocumentUpload: ({ label, onChange, help }: { label: string; onChange: (url: string) => void; help?: ReactNode }) => <div><button type="button" onClick={() => onChange('kyc://aaaaaaaaaaaaaaaaaaaaaaaa')}>{label}</button>{help}</div> }))
vi.mock('@ubuntu-fund/ui', async importOriginal => ({ ...await importOriginal<typeof import('@ubuntu-fund/ui')>(), BrandedDatePicker: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <label>{label}<input value={value} onChange={e => onChange(e.target.value)} /></label> }))
beforeEach(() => vi.clearAllMocks())
function fill() {
  render(<ThemeProvider theme={ujimoraTheme}><OrganizationKYCForm /></ThemeProvider>)
  for (const [label, value] of Object.entries({ 'Legal organization name': 'Synthetic charity', 'Registration number': 'REG-SYNTHETIC', 'Organization legal type': 'Charity', 'Registered street address': 'Synthetic street', 'Registered city': 'Accra', 'Representative full name': 'Synthetic representative', 'Representative date of birth': '1990-01-01', 'Representative ID number': 'SYNTHETIC-ID', 'Role and authority to act': 'Authorized director', 'Person 1 full name': 'Synthetic controller', 'Explain ownership and control': 'The declared directors control this organization.' })) {
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } })
  }
  for (const label of ['Organization registration document', 'Representative authorization document', 'Representative identity document']) fireEvent.click(screen.getByRole('button', { name: label, exact: true }))
}
it('keeps failed entries and submits exact private evidence and explicit declarations on retry', async () => {
  fill()
  const submit = screen.getByRole('button', { name: 'Submit organization verification' })
  expect(submit).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /I am authorized/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /accurate and complete/ }))
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Temporarily unavailable. Please retry.'))
  fireEvent.click(submit)
  expect(await screen.findByText('Temporarily unavailable. Please retry.')).toBeVisible()
  expect(screen.getByLabelText(/^Legal organization name/)).toHaveValue('Synthetic charity')
  const payload = vi.mocked(api.post).mock.calls[0][1]
  expect(payload).toEqual(expect.objectContaining({ declaration: { authorized: true, accurate: true }, personalInfo: expect.objectContaining({ dateOfBirth: '1990-01-01T00:00:00.000Z' }), businessInfo: expect.objectContaining({ registeredAddress: { street: 'Synthetic street', city: 'Accra', country: 'Ghana' }, controlPersons: [{ fullName: 'Synthetic controller', role: 'director', country: 'Ghana' }] }), documents: [{ type: 'business_registration', url: 'kyc://aaaaaaaaaaaaaaaaaaaaaaaa' }, { type: 'authorization_letter', url: 'kyc://aaaaaaaaaaaaaaaaaaaaaaaa' }, { type: 'id_card', url: 'kyc://aaaaaaaaaaaaaaaaaaaaaaaa' }] }))
  vi.mocked(api.post).mockResolvedValueOnce({ status: 'pending' })
  fireEvent.click(submit)
  await waitFor(() => expect(screen.getByText(/Organization verification submitted for review/)).toBeVisible())
  expect(api.post).toHaveBeenLastCalledWith('/kyc/business', payload)
  expect(screen.queryByLabelText(/^Legal organization name/)).not.toBeInTheDocument()
})
it('blocks an underage representative without sending a request', async () => {
  fill()
  fireEvent.change(screen.getByLabelText('Representative date of birth'), { target: { value: '2020-01-01' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /I am authorized/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /accurate and complete/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Submit organization verification' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/18/)
  expect(api.post).not.toHaveBeenCalled()
})
it('explains the representative fields and every document without submitting the form', async () => {
  fill()
  fireEvent.click(screen.getByRole('checkbox', { name: /I am authorized/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /accurate and complete/ }))
  for (const key of ORGANIZATION_KYC_HELP_FIELDS) expect(screen.getByRole('button', { name: fieldHelpLabel(ORGANIZATION_KYC_FIELD_HELP[key]) })).toHaveAttribute('type', 'button')
  // The two text fields keep their start icon and carry the help inside, as the end adornment.
  for (const [label, key] of [['Representative ID number', 'idNumber'], ['Role and authority to act', 'representativeCapacity']] as const) {
    const input = screen.getByRole('textbox', { name: label })
    const adorned = input.closest('.MuiInputBase-root') as HTMLElement
    expect(adorned).toHaveClass('MuiInputBase-adornedStart', 'MuiInputBase-adornedEnd')
    expect(within(adorned).getByRole('button', { name: fieldHelpLabel(ORGANIZATION_KYC_FIELD_HELP[key]) })).toBeInTheDocument()
  }
  for (const key of ['representativeCapacity', 'authorization'] as const) {
    const help = ORGANIZATION_KYC_FIELD_HELP[key]
    fireEvent.click(screen.getByRole('button', { name: fieldHelpLabel(help) }))
    const dialog = await screen.findByRole('dialog', { name: help.title })
    expect(dialog).toHaveTextContent(help.body[0])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  }
  expect(api.post).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByLabelText(/^Role and authority to act/)).toHaveValue('Authorized director')
})
