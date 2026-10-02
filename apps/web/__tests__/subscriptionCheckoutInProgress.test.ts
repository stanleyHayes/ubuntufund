import { afterEach, expect, it, vi } from 'vitest'
import { BillingCycle } from '@ubuntu-fund/types'
import { checkoutInProgressId, checkoutPriceChanged, createSubscriptionCheckout } from '../src/lib/subscriptions'

afterEach(() => { vi.unstubAllGlobals() })

function stubResponse(status: number, body: unknown) {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))
}
const input = { tier: 'pro', billingCycle: BillingCycle.YEARLY }

it('names the open checkout when the API refuses a purchase over an unpaid one', async () => {
  stubResponse(409, { message: 'You already have a plan payment in progress.', status: 409,
    errors: { checkoutId: ['earlier'], code: ['checkout_in_progress'] } })
  const error = await createSubscriptionCheckout(input).catch((err: unknown) => err)
  expect(checkoutInProgressId(error)).toBe('earlier')
  expect(checkoutPriceChanged(error)).toBe(false)
})

it('names the open checkout of the same purchase at an old price, which may only be cancelled', async () => {
  stubResponse(409, { message: 'That payment page charges GH₵26.99, but this purchase now costs GH₵23.99. Cancel it to pay the current price.',
    status: 409, errors: { checkoutId: ['earlier'], code: ['checkout_in_progress', 'checkout_price_changed'] } })
  const error = await createSubscriptionCheckout(input).catch((err: unknown) => err)
  expect(checkoutInProgressId(error)).toBe('earlier')
  expect(checkoutPriceChanged(error)).toBe(true)
  // Also when only the newer code is sent.
  stubResponse(409, { message: 'That payment page charges GH₵26.99.', status: 409, errors: { checkoutId: ['older'], code: ['checkout_price_changed'] } })
  const newer = await createSubscriptionCheckout(input).catch((err: unknown) => err)
  expect(checkoutInProgressId(newer)).toBe('older')
})

it('offers no cancel for other conflicts, such as confirming a plan switch', async () => {
  stubResponse(409, { message: 'Confirm the switch to continue.', status: 409, errors: { code: ['replace_current_plan'] } })
  const error = await createSubscriptionCheckout(input).catch((err: unknown) => err)
  expect(checkoutInProgressId(error)).toBeNull()
  expect(checkoutPriceChanged(error)).toBe(false)
})
