vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import CouponsPage from '@/pages/CouponsPage'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), post: vi.fn() } }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))

const coupon = (over: Record<string, unknown> = {}) => ({
  id: 'coupon-1', code: 'LAUNCH', description: '', discountType: 'percent', amount: 10, currency: 'GHS',
  maxRedemptions: 0, perUserLimit: 0, redemptions: 0, minSubtotal: 0, appliesToTiers: [], appliesToBillingCycles: [],
  appliesToSurfaces: [], allowedEmails: [], newUsersOnly: false, active: true, ...over,
})
const mount = () => render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><CouponsPage /></MemoryRouter></ThemeProvider>)

beforeEach(() => { vi.mocked(api.get).mockReset(); vi.mocked(api.put).mockReset(); vi.mocked(api.delete).mockReset() })

describe('coupon deletion', () => {
  it('offers deactivation for a used coupon and does not allow deleting it', async () => {
    vi.mocked(api.get).mockResolvedValue([coupon({ redemptions: 3 })])
    vi.mocked(api.put).mockResolvedValue(coupon({ redemptions: 3, active: false }))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete LAUNCH' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Used coupons can only be deactivated/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/coupons/coupon-1', { active: false }))
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('shows the server refusal when a coupon with an open checkout is deleted', async () => {
    vi.mocked(api.get).mockResolvedValue([coupon()])
    vi.mocked(api.delete).mockRejectedValue(new Error('This coupon has been used — deactivate it instead.'))
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete LAUNCH' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('This coupon has been used — deactivate it instead.')).toBeInTheDocument()
  })
})
