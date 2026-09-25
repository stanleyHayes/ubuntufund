import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BillingCycle, SUBSCRIPTION_PLANS, SubscriptionStatus, SubscriptionTier, type Subscription } from '@ubuntu-fund/types'

const DAY = 86_400_000
const state = vi.hoisted(() => ({ subscription: null as unknown }))
const { checkout, preview, clear } = vi.hoisted(() => ({ checkout: vi.fn(), preview: vi.fn(), clear: vi.fn() }))
vi.mock('@/lib/seo', () => ({ useSeo: () => {} }))
vi.mock('@/hooks/useSubscription', () => ({
  useMySubscription: () => ({ isLoading: false, refetch: vi.fn(), subscription: state.subscription }),
  usePlanMap: () => SUBSCRIPTION_PLANS,
}))
vi.mock('@/hooks/useCouponPreview', () => ({ useCouponPreview: () => ({ preview: null, loading: false, error: null, run: preview, clear }) }))
vi.mock('@/lib/subscriptions', () => ({ readSubscriptionHandoff: () => null, createSubscriptionCheckout: checkout,
  saveSubscriptionCheckoutHandoff: vi.fn(), isPaymentsNotConfigured: () => false }))
import { SubscriptionPage } from '@/pages/SubscriptionPage'

function subscription(over: Partial<Subscription> = {}): Subscription {
  return {
    id: 'subscription', userId: 'owner', tier: SubscriptionTier.PRO, billingProvider: 'web',
    status: SubscriptionStatus.ACTIVE, billingCycle: BillingCycle.MONTHLY, cancelAtPeriodEnd: false,
    currentPeriodStart: new Date(Date.now() - 40 * DAY), currentPeriodEnd: new Date(Date.now() - DAY),
    createdAt: new Date(), updatedAt: new Date(), ...over,
  }
}
const mount = (path = '/subscription') => render(<MemoryRouter initialEntries={[path]}><SubscriptionPage /></MemoryRouter>)
const planCard = (name: string) => screen.getAllByText(name, { selector: 'p' })
  .map((node) => node.closest('.MuiCard-root') as HTMLElement).find(Boolean)!

beforeEach(() => { checkout.mockReset() })

describe('lapsed web subscription', () => {
  it('shows an expired Pro plan as expired and lets the member buy Pro again', () => {
    state.subscription = subscription({ status: SubscriptionStatus.EXPIRED })
    mount()
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.getByText(/Your Pro plan ended on/)).toBeInTheDocument()
    const choose = within(planCard('Pro')).getByRole('button', { name: 'Choose Pro' })
    expect(choose).toBeEnabled()
    fireEvent.click(choose)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('treats a stored "active" row past its period end as expired', () => {
    state.subscription = subscription()
    mount()
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(within(planCard('Pro')).getByRole('button', { name: 'Choose Pro' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument()
  })

  it('keeps an in-force plan marked as the current plan', () => {
    state.subscription = subscription({ currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    expect(screen.queryByText('Expired')).not.toBeInTheDocument()
    expect(within(planCard('Pro')).getByText('Current plan')).toBeInTheDocument()
  })
})
