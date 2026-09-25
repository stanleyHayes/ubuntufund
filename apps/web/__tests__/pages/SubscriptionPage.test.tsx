import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BillingCycle, SUBSCRIPTION_PLANS, SubscriptionStatus, SubscriptionTier, type Subscription } from '@ubuntu-fund/types'

const DAY = 86_400_000
const state = vi.hoisted(() => ({ subscription: null as unknown, plans: null as unknown, handoff: null as unknown }))
const { checkout, preview, clear, readCheckout, clearHandoff } = vi.hoisted(() => ({
  checkout: vi.fn(), preview: vi.fn(), clear: vi.fn(), readCheckout: vi.fn(), clearHandoff: vi.fn(),
}))
vi.mock('@/lib/seo', () => ({ useSeo: () => {} }))
vi.mock('@/hooks/useSubscription', () => ({
  useMySubscription: () => ({ isLoading: false, refetch: vi.fn(), subscription: state.subscription }),
  usePlanMap: () => state.plans,
}))
vi.mock('@/hooks/useCouponPreview', () => ({ useCouponPreview: () => ({ preview: null, loading: false, error: null, run: preview, clear }) }))
vi.mock('@/lib/subscriptions', () => ({ readSubscriptionHandoff: () => state.handoff, createSubscriptionCheckout: checkout,
  saveSubscriptionCheckoutHandoff: vi.fn(), isPaymentsNotConfigured: () => false,
  readSubscriptionCheckout: readCheckout, clearSubscriptionHandoff: clearHandoff }))
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

beforeEach(() => {
  checkout.mockReset(); readCheckout.mockReset(); clearHandoff.mockReset()
  state.plans = SUBSCRIPTION_PLANS
  state.handoff = null
})

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

describe('non-renewing web plan copy', () => {
  it('describes an in-force web plan as ending, with no cancel or auto-renew claims', () => {
    state.subscription = subscription({ currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    expect(screen.getByText('Ends in')).toBeInTheDocument()
    expect(screen.queryByText('Renews in')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument()
    expect(screen.getByText(/does not renew automatically/)).toBeInTheDocument()
    fireEvent.click(within(planCard('Plus')).getByRole('button', { name: 'Choose Plus' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/One-time payment for 30 days\. Your plan does not renew automatically\./)).toBeInTheDocument()
    expect(within(dialog).queryByText(/cancel anytime/i)).not.toBeInTheDocument()
  })

  it('keeps renewal wording for App Store / Google Play subscriptions', () => {
    state.subscription = subscription({ billingProvider: 'google', currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    expect(screen.getByText('Renews in')).toBeInTheDocument()
  })
})

describe('advertised plan benefits', () => {
  it('lists only benefits the platform delivers', () => {
    state.subscription = subscription({ currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    for (const unbuilt of [/featured listing/i, /priority support/i, /advanced analytics/i, /^analytics$/i, /custom branding/i]) {
      expect(screen.queryAllByText(unbuilt)).toHaveLength(0)
    }
    expect(screen.getAllByText('Live streaming').length).toBeGreaterThan(0)
    expect(screen.getByText('Organization team seats (incl. owner)')).toBeInTheDocument()
  })
})

describe('buying over a running plan', () => {
  it('offers an early renewal of the running plan that adds time instead of replacing it', () => {
    state.subscription = subscription({ currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    fireEvent.click(within(planCard('Pro')).getByRole('button', { name: 'Renew Pro' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Renew Pro' })).toBeInTheDocument()
    expect(within(dialog).getByText(/Adds 30 days after your current plan ends/)).toBeInTheDocument()
  })

  it('warns that switching replaces the running plan and sends the confirmation', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.STARTER, currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    checkout.mockResolvedValue({ checkout: { id: 'new' }, preview: { finalAmount: 149, currency: 'GHS' } })
    mount()
    fireEvent.click(within(planCard('Pro')).getByRole('button', { name: 'Choose Pro' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Switch to Pro' })).toBeInTheDocument()
    expect(within(dialog).getByText(/unused time on Plus is not refunded or credited/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace plan and pay' }))
    await waitFor(() => expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ tier: 'pro', replaceCurrentPlan: true })))
  })

  it('opens checkout from a ?tier= link only for a self-serve plan', () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE, currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount('/subscription?tier=enterprise')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    mount('/subscription?tier=pro')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not sell a billing cycle whose price is zero', () => {
    state.plans = { ...SUBSCRIPTION_PLANS, pro: { ...SUBSCRIPTION_PLANS.pro, priceYearly: 0 } }
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount('/subscription?tier=pro&billingCycle=yearly')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(planCard('Pro')).getByRole('button', { name: 'Yearly not offered' })).toBeDisabled()
  })
})

describe('returning-from-payment banner', () => {
  const handoff = { checkoutId: 'checkout-1', tier: 'pro', billingCycle: BillingCycle.MONTHLY, finalAmount: 149, currency: 'GHS' }

  it('shows the banner only while the server still has the checkout pending', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    state.handoff = handoff
    readCheckout.mockResolvedValue({ id: 'checkout-1', status: 'pending' })
    mount()
    expect(await screen.findByText(/Returning from payment\?/)).toBeInTheDocument()
    expect(readCheckout).toHaveBeenCalledWith('checkout-1')
  })

  it('clears a settled checkout instead of nagging', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    state.handoff = handoff
    readCheckout.mockResolvedValue({ id: 'checkout-1', status: 'succeeded' })
    mount()
    await waitFor(() => expect(clearHandoff).toHaveBeenCalledWith('checkout-1'))
    expect(screen.queryByText(/Returning from payment\?/)).not.toBeInTheDocument()
  })
})
