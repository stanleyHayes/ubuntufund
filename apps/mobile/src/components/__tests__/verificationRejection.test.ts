import { createElement, type ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import VerificationScreen from '../../../app/verification'
import { api } from '@/lib/api'
const mocks = vi.hoisted(() => ({ push: vi.fn(), user: { id: 'applicant' } }))
vi.mock('react-native', () => ({ View: ({ children }: { children: ReactNode }) => createElement('div', {}, children), ScrollView: ({ children }: { children: ReactNode }) => createElement('div', {}, children), StyleSheet: { create: (styles: unknown) => styles }, Animated: { View: ({ children }: { children: ReactNode }) => createElement('div', {}, children), Value: class {}, timing: () => ({}), sequence: () => ({}), loop: () => ({ start() {}, stop() {} }) } }))
vi.mock('react-native-paper', () => ({ Text: ({ children }: { children: ReactNode }) => createElement('span', {}, children), Icon: () => null }))
vi.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}), useNeu: () => ({ raised: {}, inset: {} }) }))
vi.mock('@/components/KYCInformationHistory', () => ({ KYCInformationHistory: () => null }))
vi.mock('@/components/EmptyState', () => ({ EmptyState: () => null }))
vi.mock('@/components/SignInRequired', () => ({ SignInRequired: () => null }))
vi.mock('@/components/anim/FadeInUp', () => ({ FadeInUp: ({ children }: { children: ReactNode }) => createElement('div', {}, children) }))
vi.mock('@/components/Loading', () => ({ Button: ({ children, onPress, disabled }: { children: ReactNode; onPress: () => void; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled }, children) }))
beforeEach(() => vi.clearAllMocks())
const rejected = { id: 'rejected-1', type: 'identity', status: 'rejected', rejectionReason: 'Please submit a readable identity document.', createdAt: '2026-09-13T00:00:00Z' }
it('renders the private rejection reason and opens the corrected application form', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ kycStatus: 'rejected', kycLevel: 0, verifications: [rejected] })
  render(createElement(VerificationScreen))
  expect(await screen.findByText(rejected.rejectionReason)).toBeTruthy()
  fireEvent.click(screen.getByText('Submit corrected application'))
  expect(mocks.push).toHaveBeenCalledWith('/kyc')
})
it('does not offer another submission when one is already being reviewed', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ kycStatus: 'pending', kycLevel: 0, verifications: [rejected, { ...rejected, id: 'pending-1', status: 'pending', rejectionReason: undefined }] })
  render(createElement(VerificationScreen))
  expect(await screen.findByText(rejected.rejectionReason)).toBeTruthy()
  expect(screen.queryByText('Submit corrected application')).toBeNull()
})

it('labels each application by evidence type rather than the account-wide KYC level', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ kycStatus: 'verified', kycLevel: 3, verifications: [
    { ...rejected, id: 'organization', type: 'business', status: 'pending', rejectionReason: undefined },
    { ...rejected, id: 'address', type: 'address', status: 'approved', rejectionReason: undefined },
    { ...rejected, id: 'identity', type: 'identity', status: 'rejected' },
  ] })
  render(createElement(VerificationScreen))
  expect(await screen.findByText('Organization verification')).toBeTruthy()
  expect(screen.getByText('Address verification')).toBeTruthy()
  expect(screen.getByText('Identity verification')).toBeTruthy()
  expect(screen.queryByText('Institutional')).toBeNull()
  expect(screen.queryByText('National ID')).toBeNull()
})

it('shows expired evidence and opens renewal without claiming current approval', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ kycStatus: 'expired', kycLevel: 0, verifications: [{ ...rejected, status: 'expired', rejectionReason: undefined, expiresAt: '2020-01-01T00:00:00Z' }] })
  render(createElement(VerificationScreen))
  expect(await screen.findByText('Expired')).toBeTruthy()
  expect(screen.getByText(/Expires Jan 1, 2020/)).toBeTruthy()
  fireEvent.click(screen.getByText('Renew verification'))
  expect(mocks.push).toHaveBeenCalledWith('/kyc')
})
