// The checkout dialog with the real coupon-quote hook: only the endpoint and
// checkout are mocked, so the debounce and the quote's inputs are exercised.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { BillingCycle, SUBSCRIPTION_PLANS, SubscriptionStatus, SubscriptionTier } from '@ubuntu-fund/types'

const { checkout, previewApi } = vi.hoisted(() => ({ checkout: vi.fn(), previewApi: vi.fn() }))
vi.mock('@/lib/seo', () => ({ useSeo: () => {} }))
vi.mock('@/hooks/useSubscription', () => ({
  useMySubscription: () => ({ isLoading: false, refetch: vi.fn(), subscription: {
    id: 's', userId: 'u', tier: SubscriptionTier.FREE, billingProvider: 'web', status: SubscriptionStatus.ACTIVE,
    billingCycle: BillingCycle.MONTHLY, cancelAtPeriodEnd: false, currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 864e5),
    createdAt: new Date(), updatedAt: new Date(),
  } }),
  usePlanMap: () => ({ plans: SUBSCRIPTION_PLANS, loaded: true, error: false, retry: vi.fn() }),
}))
vi.mock('@/lib/coupons', () => ({ previewCoupon: previewApi }))
vi.mock('@/lib/subscriptions', () => ({ readSubscriptionHandoff: () => null, createSubscriptionCheckout: checkout,
  saveSubscriptionCheckoutHandoff: vi.fn(), isPaymentsNotConfigured: () => false,
  readSubscriptionCheckout: vi.fn(), clearSubscriptionHandoff: vi.fn(), abandonSubscriptionCheckout: vi.fn(),
  checkoutInProgressId: () => null, checkoutPriceChanged: () => false }))
import { SubscriptionPage } from '@/pages/SubscriptionPage'

it('never shows one code\'s total while checkout would charge another\'s', async () => {
  previewApi.mockResolvedValueOnce({ valid: true, code: 'SAVE50', baseAmount: 29.99, discountAmount: 15, finalAmount: 14.99, currency: 'GHS' })
  let answerSave5: (value: unknown) => void = () => {}
  previewApi.mockImplementationOnce(() => new Promise((resolve) => { answerSave5 = resolve })) // SAVE5's quote is still on its way
  checkout.mockImplementation(() => new Promise(() => {}))
  render(<MemoryRouter initialEntries={['/subscription?tier=pro']}><SubscriptionPage /></MemoryRouter>)
  const dialog = screen.getByRole('dialog')
  const box = within(dialog).getByLabelText('Coupon code (optional)')
  fireEvent.change(box, { target: { value: 'SAVE50' } })
  expect(await within(dialog).findByText('GH₵14.99', {}, { timeout: 3000 })).toBeInTheDocument()
  fireEvent.change(box, { target: { value: 'SAVE5' } })
  // SAVE50's total is gone at once, and nothing can be bought until SAVE5 is priced.
  expect(within(dialog).queryByText('GH₵14.99')).not.toBeInTheDocument()
  expect(within(dialog).getByText('Checking…')).toBeInTheDocument()
  await waitFor(() => expect(previewApi).toHaveBeenCalledTimes(2))
  const pay = within(dialog).getByRole('button', { name: 'Checking coupon…' })
  expect(pay).toBeDisabled()
  fireEvent.click(pay)
  expect(checkout).not.toHaveBeenCalled()
  // SAVE5's quote arrives: its total is shown, and that is the code checkout is sent.
  answerSave5({ valid: true, code: 'SAVE5', baseAmount: 29.99, discountAmount: 1.5, finalAmount: 28.49, currency: 'GHS' })
  expect(await within(dialog).findByText('GH₵28.49')).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continue to payment' }))
  expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ tier: 'pro', couponCode: 'SAVE5' }))
})
