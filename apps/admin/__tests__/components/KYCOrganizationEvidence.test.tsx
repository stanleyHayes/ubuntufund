import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Dialog, ThemeProvider } from '@mui/material'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import KYCDetailDialog from '@/components/kyc/KYCDetailDialog'
import type { KYCVerification } from '@/types/api'
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
vi.mock('@/components/kyc/KYCDocumentPreview', () => ({ KYCDocumentPreview: () => null }))
const base: KYCVerification = { id: 'business-fixture', userId: 'owner', userName: 'Organization fixture', reviewVersion: 'a'.repeat(64), verificationType: 'business', status: 'pending', riskLevel: 'medium', documents: [], retryCount: 0, createdAt: new Date(), updatedAt: new Date() }
function mount(record: KYCVerification) {
  const onApprove = vi.fn()
  render(<ThemeProvider theme={ujimoraTheme}><Dialog open><KYCDetailDialog verification={record} onApprove={onApprove} onReject={() => {}} onClose={() => {}} onRequestMore={() => {}} /></Dialog></ThemeProvider>)
  return onApprove
}
it('shows private organization authority and controlling-person declarations without treating them as staff approval', () => {
  const onApprove = mount({ ...base, businessInfo: { businessName: 'Synthetic organization', registrationNumber: 'REG-FIXTURE', registeredAddress: { street: 'Fixture street', city: 'Accra', country: 'Ghana', gpsAddress: 'GA-123-4567' }, representativeCapacity: 'Authorized trustee', ownershipExplanation: 'Trustees govern the organization without shareholders.', controlPersons: [{ fullName: 'Trustee fixture', role: 'trustee', country: 'Ghana' }, { fullName: 'Owner fixture', role: 'beneficial_owner', country: 'Ghana', ownershipPercent: 25 }], declaration: { authorized: true, accurate: true, acceptedAt: new Date('2026-09-13T00:00:00Z') } } })
  expect(screen.getByText(/Fixture street, Accra, Ghana, GA-123-4567/)).toBeInTheDocument()
  expect(screen.getByText(/Representative capacity: Authorized trustee/)).toBeInTheDocument()
  expect(screen.getByText(/Trustees govern the organization/)).toBeInTheDocument()
  expect(screen.getByText(/Trustee fixture · trustee · Ghana/)).toBeInTheDocument()
  expect(screen.getByText(/Owner fixture · beneficial owner · Ghana · 25% ownership/)).toBeInTheDocument()
  expect(screen.getByText(/Applicant declarations: authority confirmed; accuracy confirmed/)).toBeInTheDocument()
  expect(screen.getByText(/These are applicant declarations/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Internal review findings'), { target: { value: 'Registration and representative authority reviewed.' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed the application/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  expect(onApprove).toHaveBeenCalledWith({ evidenceReviewed: true, reviewNotes: 'Registration and representative authority reviewed.' })
})
it('shows missing historical organization details without inventing declarations', () => {
  mount({ ...base, businessInfo: { businessName: 'Legacy fixture' } })
  expect(screen.getByText('Registered address: Not provided')).toBeInTheDocument()
  expect(screen.getByText('Representative capacity: Not provided')).toBeInTheDocument()
  expect(screen.getByText('No controlling persons declared.')).toBeInTheDocument()
  expect(screen.getByText(/authority not confirmed; accuracy not confirmed/)).toBeInTheDocument()
})
