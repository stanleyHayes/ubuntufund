import { afterEach, expect, it, vi } from 'vitest'
import { BillingCycle } from '@ubuntu-fund/types'
import { checkoutInProgressId, createSubscriptionCheckout } from '../src/lib/subscriptions'

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
})

it('offers no cancel for other conflicts, such as confirming a plan switch', async () => {
  stubResponse(409, { message: 'Confirm the switch to continue.', status: 409, errors: { code: ['replace_current_plan'] } })
  const error = await createSubscriptionCheckout(input).catch((err: unknown) => err)
  expect(checkoutInProgressId(error)).toBeNull()
})
