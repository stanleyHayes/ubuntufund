import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { BillingCycle, SUBSCRIPTION_PLANS, SubscriptionStatus, SubscriptionTier } from '@ubuntu-fund/types'
const { checkout, preview, clear } = vi.hoisted(() => ({ checkout: vi.fn(), preview: vi.fn(), clear: vi.fn() }))
vi.mock('@/lib/seo', () => ({ useSeo: () => {} }))
vi.mock('@/hooks/useSubscription', () => ({
  useMySubscription: () => ({ isLoading: false, refetch: vi.fn(), subscription: {
    id: 'subscription', userId: 'owner', tier: SubscriptionTier.PRO, billingProvider: 'google',
    status: SubscriptionStatus.ACTIVE, billingCycle: BillingCycle.MONTHLY, cancelAtPeriodEnd: false,
    currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86_400_000),
  } }),
  usePlanMap: () => SUBSCRIPTION_PLANS,
}))
vi.mock('@/hooks/useCouponPreview', () => ({ useCouponPreview: () => ({ preview: null, loading: false, error: null, run: preview, clear }) }))
vi.mock('@/lib/subscriptions', () => ({ readSubscriptionHandoff: () => null, createSubscriptionCheckout: checkout,
  saveSubscriptionCheckoutHandoff: vi.fn(), isPaymentsNotConfigured: () => false }))
import { SubscriptionPage } from '@/pages/SubscriptionPage'

it('directs store subscribers to their billing service and does not open a URL-selected web checkout', () => {
  render(<MemoryRouter initialEntries={['/subscription?tier=starter']}><SubscriptionPage /></MemoryRouter>)
  expect(screen.getByText(/Your subscription is billed through Google Play/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Manage subscription' })).toHaveAttribute('href', 'https://play.google.com/store/account/subscriptions?package=com.ujimora.app')
  expect(screen.queryByRole('button', { name: 'Cancel subscription' })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(checkout).not.toHaveBeenCalled()
})
