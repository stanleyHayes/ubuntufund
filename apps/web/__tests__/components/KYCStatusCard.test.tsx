import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import KYCStatus from '@/components/KYCStatus'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

const status = (kycLevel: number, kycStatus = 'verified') => ({ kycStatus, kycLevel, verifications: [] })

it('shows a verified individual as complete, with no business step they cannot submit', async () => {
  vi.mocked(api.get).mockResolvedValue(status(1))
  render(<MemoryRouter><KYCStatus role="user" /></MemoryRouter>)
  expect(await screen.findByText('1/1')).toBeVisible()
  expect(screen.getByText('Level 1 — Verified')).toBeVisible()
  expect(screen.queryByText(/Business verification|Organization verification/)).toBeNull()
  expect(screen.getByRole('link', { name: 'View' })).toBeVisible()
})

it('shows an organization with representative identity only as 1/3 needing organization verification', async () => {
  vi.mocked(api.get).mockResolvedValue(status(1))
  render(<MemoryRouter><KYCStatus role="organization" /></MemoryRouter>)
  expect(await screen.findByText('1/3')).toBeVisible()
  expect(screen.getByText('Organization verification')).toBeVisible()
})

it('asks an unverified individual only for identity verification and offers renewal when expired', async () => {
  vi.mocked(api.get).mockResolvedValue(status(0, 'expired'))
  render(<MemoryRouter><KYCStatus role="user" /></MemoryRouter>)
  expect(await screen.findByText('Identity verification (includes address proof)')).toBeVisible()
  expect(screen.queryByText('Address verification')).toBeNull()
  expect(screen.getByRole('link', { name: 'Renew' })).toBeVisible()
})
