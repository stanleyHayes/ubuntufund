vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { LIVE_PLANS, livePlan } from '../fixtures/livePlans'
const state = vi.hoisted(() => ({
  plans: { data: [] as unknown[], isLoading: false, error: null as string | null, retry: (() => {}) as () => void },
}))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), post: vi.fn() } }))
vi.mock('@/hooks/useApiData', () => ({ useAdminPlans: () => state.plans }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
import { api } from '@/lib/api'
import CouponsPage from '@/pages/CouponsPage'
import CreateCouponPage from '@/pages/CreateCouponPage'

// The create page scrolls each step's heading into view; jsdom has no layout, so no scrollIntoView.
Element.prototype.scrollIntoView = vi.fn()

/** A plan switched off on the Plans page: no longer sold, but coupons may still name it. */
const legacy = { ...livePlan('pro'), tier: 'legacy', name: 'Legacy', active: false }
const coupon = (over: Record<string, unknown> = {}) => ({
  id: 'coupon-1', code: 'LAUNCH', description: '', discountType: 'percent', amount: 10, currency: 'GHS',
  maxRedemptions: 0, perUserLimit: 0, redemptions: 0, minSubtotal: 0, appliesToTiers: [], appliesToBillingCycles: [],
  appliesToSurfaces: [], allowedEmails: [], newUsersOnly: false, active: true, ...over,
})
const mount = (page: ReactElement) => render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter>{page}</MemoryRouter></ThemeProvider>)
/** The tier picker's options, opened from its field. */
const openTiers = (field: HTMLElement) => {
  fireEvent.mouseDown(field)
  return screen.getByRole('listbox')
}

beforeEach(() => {
  state.plans = { data: [...LIVE_PLANS, legacy], isLoading: false, error: null, retry: vi.fn() }
  vi.mocked(api.get).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.post).mockReset()
})
afterEach(cleanup)

describe('coupons list and edit dialog', () => {
  it('names tiers by their live plan names and keeps a retired tier the coupon names', async () => {
    vi.mocked(api.get).mockResolvedValue([coupon({ appliesToTiers: ['starter', 'legacy'] }), coupon({ id: 'coupon-2', code: 'PRO10', appliesToTiers: ['pro'] })])
    vi.mocked(api.put).mockImplementation(async (_path: string, body: unknown) => coupon(body as Record<string, unknown>))
    mount(<CouponsPage />)
    expect(await screen.findByText('Starter, Legacy')).toBeVisible()
    expect(screen.getByText('Pro')).toBeVisible()

    // A coupon that does not name the retired plan is never offered it.
    fireEvent.click(screen.getByRole('button', { name: 'Edit PRO10' }))
    let dialog = await screen.findByRole('dialog', { name: 'Edit Coupon' })
    let listbox = openTiers(within(dialog).getByRole('combobox', { name: /Applies to Tiers/ }))
    expect(within(listbox).queryByRole('option', { name: 'Legacy' })).toBeNull()
    fireEvent.keyDown(listbox, { key: 'Escape' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Coupon' })).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Edit LAUNCH' }))
    dialog = await screen.findByRole('dialog', { name: 'Edit Coupon' })
    const tiers = within(dialog).getByRole('combobox', { name: /Applies to Tiers/ })
    expect(tiers).toHaveTextContent('Starter, Legacy')
    listbox = openTiers(tiers)
    expect(within(listbox).getByRole('option', { name: 'Legacy' })).toHaveAccessibleDescription('Retired: not sold at web checkout.')
    expect(within(listbox).getByRole('option', { name: 'Legacy' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(listbox, { key: 'Escape' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/coupons/coupon-1', expect.objectContaining({ appliesToTiers: ['starter', 'legacy'] })))
  })
})

describe('create coupon', () => {
  const startCoupon = () => {
    mount(<CreateCouponPage />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Code' }), { target: { value: 'org10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  }
  const heading = () => screen.getByRole('heading', { level: 2 })

  it('reviews the chosen plan by its live name and creates the coupon for it', async () => {
    vi.mocked(api.post).mockResolvedValue({})
    startCoupon()
    const listbox = openTiers(await screen.findByRole('combobox', { name: /Applies to Tiers/ }))
    expect(within(listbox).queryByRole('option', { name: 'Legacy' })).toBeNull()
    fireEvent.click(within(listbox).getByRole('option', { name: 'Organization' }))
    fireEvent.keyDown(listbox, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(heading()).toHaveTextContent('Limits & schedule'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(heading()).toHaveTextContent('Review'))
    expect(screen.getByText('Plans', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Organization')
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/coupons', expect.objectContaining({ code: 'ORG10', appliesToTiers: ['organization'] })))
  })

  it('will not leave the tier step while plans are loading', async () => {
    state.plans = { data: [], isLoading: true, error: null, retry: vi.fn() }
    startCoupon()
    await waitFor(() => expect(heading()).toHaveTextContent('Eligibility'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('Plans are still loading. Choose which plans this coupon applies to once they appear.')).toBeVisible()
    expect(heading()).toHaveTextContent('Eligibility')
  })

  it('will not leave the tier step after plans fail, so the coupon never silently covers every plan', async () => {
    const retry = vi.fn()
    state.plans = { data: [], isLoading: false, error: 'The server could not complete this request.', retry }
    startCoupon()
    await waitFor(() => expect(heading()).toHaveTextContent('Eligibility'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    const refusal = 'Choose which plans this coupon applies to before continuing: retry loading the plans below.'
    expect(await screen.findByText(refusal)).toBeVisible()
    expect(heading()).toHaveTextContent('Eligibility')
    // Retrying clears the refusal, which described the failed load.
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(refusal)).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
  })
})
