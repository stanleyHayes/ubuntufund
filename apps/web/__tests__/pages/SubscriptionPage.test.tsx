import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BillingCycle, SUBSCRIPTION_PLANS, SubscriptionStatus, SubscriptionTier, type Subscription, type SubscriptionPlan } from '@ubuntu-fund/types'

const DAY = 86_400_000
const state = vi.hoisted(() => ({
  subscription: null as unknown, plans: null as unknown, handoff: null as unknown,
  plansLoaded: true, plansError: false, preview: null as unknown, couponLoading: false, couponError: null as string | null,
}))
const { checkout, preview, clear, readCheckout, clearHandoff, abandon, retryPlans } = vi.hoisted(() => ({
  checkout: vi.fn(), preview: vi.fn(), clear: vi.fn(), readCheckout: vi.fn(), clearHandoff: vi.fn(), abandon: vi.fn(), retryPlans: vi.fn(),
}))
vi.mock('@/lib/seo', () => ({ useSeo: () => {} }))
vi.mock('@/hooks/useSubscription', () => ({
  useMySubscription: () => ({ isLoading: false, refetch: vi.fn(), subscription: state.subscription }),
  usePlanMap: () => ({ plans: state.plans, loaded: state.plansLoaded, error: state.plansError, retry: retryPlans }),
}))
vi.mock('@/hooks/useCouponPreview', () => ({ useCouponPreview: () => ({ preview: state.preview, loading: state.couponLoading, error: state.couponError, run: preview, clear }) }))
vi.mock('@/lib/subscriptions', () => ({ readSubscriptionHandoff: () => state.handoff, createSubscriptionCheckout: checkout,
  saveSubscriptionCheckoutHandoff: vi.fn(), isPaymentsNotConfigured: () => false,
  readSubscriptionCheckout: readCheckout, clearSubscriptionHandoff: clearHandoff, abandonSubscriptionCheckout: abandon,
  checkoutInProgressId: (err: { inProgress?: string }) => err?.inProgress ?? null,
  checkoutPriceChanged: (err: { priceChanged?: boolean }) => err?.priceChanged === true }))
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
/** The plan cells of a comparison-table row, in column order. */
const rowCells = (label: string) => Array.from(screen.getByText(label, { selector: 'p' }).parentElement!.parentElement!.children).slice(1) as HTMLElement[]
/** A statistic on the member's own plan card (label and value), which comes before the plan cards. */
const planStat = (label: string) => screen.getAllByText(label, { selector: 'p' })[0].parentElement!.parentElement as HTMLElement

// Production rows written before a field existed simply lack it (today:
// maxCollaboratorsPerCampaign on Free, Starter, Pro and Enterprise).
function legacyRow(plan: SubscriptionPlan, over: Partial<SubscriptionPlan>): SubscriptionPlan {
  const { maxCollaboratorsPerCampaign: _missing, ...row } = { ...plan, ...over }
  return row as SubscriptionPlan
}
/** The live GET /plans rows as of 2026-09-30 (legacy and v6 prices mixed). */
const LIVE_PLANS: Record<string, SubscriptionPlan> = {
  free: legacyRow(SUBSCRIPTION_PLANS.free, { name: 'Free', platformFeePercent: 5, maxCampaignGoal: 5000, popular: false }),
  starter: legacyRow(SUBSCRIPTION_PLANS.starter, { name: 'Starter', priceMonthly: 9.99, priceYearly: 99, platformFeePercent: 3.5, popular: false }),
  pro: legacyRow(SUBSCRIPTION_PLANS.pro, { priceMonthly: 29.99, priceYearly: 299, platformFeePercent: 2, campaignCollaboration: false, popular: false }),
  organization: { ...SUBSCRIPTION_PLANS.organization, onBehalfCampaigns: false, popular: false },
  enterprise: legacyRow(SUBSCRIPTION_PLANS.enterprise, { priceMonthly: 999.99, priceYearly: 9999.9, platformFeePercent: 1, sortOrder: 3, maxOnBehalfCampaigns: 0, popular: false }),
}

beforeEach(() => {
  checkout.mockReset(); readCheckout.mockReset(); clearHandoff.mockReset(); abandon.mockReset(); retryPlans.mockReset()
  state.plans = SUBSCRIPTION_PLANS
  state.plansLoaded = true
  state.plansError = false
  state.preview = null
  state.couponLoading = false
  state.couponError = null
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

  it('states the Free fee and campaign limit that apply once the plan has ended, not the ended plan’s', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ status: SubscriptionStatus.EXPIRED })
    mount()
    expect(planStat('Platform fee on new campaigns')).toHaveTextContent(/^Platform fee on new campaigns5%$/)
    expect(planStat('Active campaigns')).toHaveTextContent(/^Active campaigns1$/)
  })

  it('states the running plan’s own fee and campaign limit while it is in force', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    expect(planStat('Platform fee on new campaigns')).toHaveTextContent(/^Platform fee on new campaigns2%$/)
    expect(planStat('Active campaigns')).toHaveTextContent(/^Active campaigns10$/)
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
    fireEvent.click(within(planCard('Starter')).getByRole('button', { name: 'Choose Starter' }))
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

  it('shows campaigns on behalf of others with their limit and extra fee', () => {
    state.subscription = subscription({ currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    state.plans = Object.fromEntries(Object.entries(SUBSCRIPTION_PLANS).map(([tier, plan]) => [tier,
      tier === SubscriptionTier.ORGANIZATION ? { ...plan, onBehalfCampaigns: true, maxOnBehalfCampaigns: 3, onBehalfFeePercent: 2 } : plan]))
    mount()
    // The comparison row, and Enterprise's card (unlimited, no extra fee).
    expect(screen.getAllByText('Campaigns on behalf of others').length).toBeGreaterThanOrEqual(2)
    expect(within(planCard('Enterprise')).getByText('Campaigns on behalf of others')).toBeInTheDocument()
    expect(screen.getByText('Up to 3 active')).toBeInTheDocument()
    expect(screen.getByText('+2% platform fee')).toBeInTheDocument()
    expect(within(planCard('Organization')).getByText('Campaigns on behalf of others · up to 3 active · +2% platform fee')).toBeInTheDocument()
    expect(within(planCard('Pro')).queryByText(/Campaigns on behalf of others/)).not.toBeInTheDocument()
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
    expect(within(dialog).getByText(/unused time on Starter is not refunded or credited/)).toBeInTheDocument()
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
    const pro = planCard('Pro')
    expect(within(pro).getByRole('button', { name: 'Yearly not offered' })).toBeDisabled()
    // The price says so too, as on marketing, instead of a GH₵0 one-time payment.
    expect(within(pro).getByText('Yearly not offered', { selector: 'p' })).toBeInTheDocument()
    expect(within(pro).queryByText('GH₵0')).not.toBeInTheDocument()
    expect(within(pro).queryByText(/One-time payment/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    expect(within(planCard('Pro')).getByText('GH₵29.99')).toBeInTheDocument()
    expect(within(planCard('Pro')).getByText(/One-time payment/)).toBeInTheDocument()
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

describe('an earlier unpaid checkout blocking a new purchase', () => {
  const inProgress = Object.assign(new Error('You already have a plan payment in progress.'), { inProgress: 'earlier' })

  it('lets the member cancel the earlier checkout and carry on with this one', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    checkout.mockRejectedValueOnce(inProgress).mockResolvedValueOnce({ checkout: { id: 'new' }, preview: { finalAmount: 149, currency: 'GHS' } })
    abandon.mockResolvedValue({ id: 'earlier', status: 'expired' })
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue to payment' }))
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Cancel it and continue' }))
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(2))
    expect(abandon).toHaveBeenCalledWith('earlier')
    expect(clearHandoff).toHaveBeenCalledWith('earlier')
  })

  it('reports an earlier payment that went through instead of buying again', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    checkout.mockRejectedValueOnce(inProgress)
    abandon.mockResolvedValue({ id: 'earlier', status: 'succeeded' })
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue to payment' }))
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Cancel it and continue' }))
    expect(await within(dialog).findByText(/earlier plan payment went through/)).toBeInTheDocument()
    expect(checkout).toHaveBeenCalledTimes(1)
  })

  it('shows no cancel action for other checkout errors', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    checkout.mockRejectedValueOnce(new Error('That subscription plan is not available'))
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue to payment' }))
    expect(await within(dialog).findByText('That subscription plan is not available')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Cancel it and continue' })).not.toBeInTheDocument()
  })
})

describe('live plans only', () => {
  it('keeps the skeleton and opens no checkout until the plans have loaded', () => {
    state.plans = {}
    state.plansLoaded = false
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount('/subscription?tier=pro')
    expect(screen.getByLabelText('Loading subscription')).toBeInTheDocument()
    expect(screen.queryByText(/GH₵/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an error with Retry instead of stale prices, and blocks checkout', () => {
    state.plans = {}
    state.plansLoaded = false
    state.plansError = true
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount('/subscription?tier=pro')
    expect(screen.getByRole('alert')).toHaveTextContent('Current plans and prices could not be loaded, so checkout is unavailable.')
    expect(screen.queryByText(/GH₵/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Choose / })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retryPlans).toHaveBeenCalledTimes(1)
  })

  it('still points a member back to a pending payment when the plans fail', async () => {
    state.plans = {}
    state.plansLoaded = false
    state.plansError = true
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    state.handoff = { checkoutId: 'checkout-1', tier: 'pro', billingCycle: BillingCycle.MONTHLY, finalAmount: 29.99, currency: 'GHS' }
    readCheckout.mockResolvedValue({ id: 'checkout-1', status: 'pending' })
    mount()
    expect(await screen.findByText(/Returning from payment\?/)).toBeInTheDocument()
    expect(screen.getByText(/could not be loaded, so checkout is unavailable/)).toBeInTheDocument()
  })

  it('shows the Free plan for a tier the plans no longer list instead of crashing', () => {
    state.subscription = subscription({ tier: 'retired-tier', currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    expect(screen.getByText(`${SUBSCRIPTION_PLANS.free.name} Plan`)).toBeInTheDocument()
  })

  it('names the live free plan when a paid plan has ended', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ status: SubscriptionStatus.EXPIRED })
    mount()
    expect(screen.getByText(/Your Pro plan ended on .+\. Free features apply until you buy a plan again\./)).toBeInTheDocument()
    expect(screen.queryByText(/Community features/)).not.toBeInTheDocument()
  })

  it('prices the dialog from the coupon quote, which is what checkout charges', () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    // The plan map says 29.99; the server quotes a different live price.
    state.preview = { valid: true, code: 'SAVE10', baseAmount: 35, discountAmount: 3.5, finalAmount: 31.5, currency: 'GHS' }
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('GH₵35')).toBeInTheDocument()
    expect(within(dialog).getByText('GH₵31.50')).toBeInTheDocument()
    expect(within(dialog).queryByText('GH₵29.99')).not.toBeInTheDocument()
  })
})

describe('plan comparison with the live plan rows', () => {
  it('never renders undefined, null or NaN, on either billing cycle', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    expect(document.body.textContent).not.toMatch(/undefined|null|NaN/)
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(document.body.textContent).not.toMatch(/undefined|null|NaN/)
  })

  it('shows ✗ for collaborators without collaboration, the cap when set, and — when unstated', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    const [free, starter, pro, organization, enterprise] = rowCells('Collaborators per campaign')
    for (const cell of [free, starter, pro]) expect(within(cell).getByTestId('CloseRoundedIcon')).toBeInTheDocument()
    expect(organization).toHaveTextContent(/^10$/)
    expect(within(enterprise).getByRole('img', { name: 'Not specified' })).toHaveTextContent('—')
  })

  it('shows Unlimited for a -1 collaborator cap', () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    const cells = rowCells('Collaborators per campaign')
    expect(cells.map((cell) => cell.textContent)).toEqual(['', '', '3', '10', 'Unlimited'])
    expect(within(cells[0]).getByTestId('CloseRoundedIcon')).toBeInTheDocument()
  })

  it('shows yearly prices per month with two decimals and the grouped yearly total', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    expect(within(planCard('Starter')).getByText('GH₵9.99')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(within(planCard('Organization')).getByText('GH₵332.50')).toBeInTheDocument()
    expect(within(planCard('Organization')).getByText(/^GH₵3,990 for 1 year/)).toBeInTheDocument()
    expect(within(planCard('Starter')).getByText('GH₵8.25')).toBeInTheDocument()
    expect(within(planCard('Pro')).getByText('GH₵24.92')).toBeInTheDocument()
  })
})

describe('recommended plan', () => {
  it('follows the admin Popular switch, not the Pro tier', () => {
    state.plans = { ...LIVE_PLANS, starter: { ...LIVE_PLANS.starter, popular: true } }
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    expect(screen.getAllByText('Recommended for growth')).toHaveLength(1)
    expect(within(planCard('Starter')).getByText('Recommended for growth')).toBeInTheDocument()
    expect(within(planCard('Pro')).queryByText('Recommended for growth')).not.toBeInTheDocument()
  })

  it('recommends nothing when no plan is marked Popular', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    expect(screen.queryByText('Recommended for growth')).not.toBeInTheDocument()
  })
})

describe('upgrade call to action', () => {
  it('offers the plan marked Popular, by its name', () => {
    state.plans = { ...LIVE_PLANS, organization: { ...LIVE_PLANS.organization, popular: true } }
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    expect(screen.queryByRole('button', { name: 'Upgrade to Pro' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Organization' }))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Upgrade to Organization' })).toBeInTheDocument()
  })

  it('offers the cheapest plan on sale when none is marked Popular', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ status: SubscriptionStatus.EXPIRED })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Starter' }))
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Upgrade to Starter' })).toBeInTheDocument()
  })

  it('passes over a Popular plan the selected cycle does not sell', () => {
    state.plans = { ...LIVE_PLANS, pro: { ...LIVE_PLANS.pro, popular: true, priceYearly: 0 } }
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(screen.queryByRole('button', { name: 'Upgrade to Pro' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upgrade to Starter' })).toBeInTheDocument()
  })

  it('is hidden when no plan can be bought here', () => {
    state.plans = { free: LIVE_PLANS.free, enterprise: LIVE_PLANS.enterprise }
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    expect(screen.queryByText('Ready to grow your impact?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Upgrade to / })).not.toBeInTheDocument()
  })
})

describe('the fee a member is shown is the fee they are charged', () => {
  it('names the stat for new campaigns and says existing campaigns keep their fee', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    mount()
    expect(planStat('Platform fee on new campaigns')).toHaveTextContent(/^Platform fee on new campaigns5%$/)
    expect(screen.getByText(/^Campaigns you already run keep the fee they were created with; creator withdrawals use your current plan’s fee\.$/)).toBeInTheDocument()
    // The upgrade call to action promises lower fees on new campaigns only.
    expect(screen.getByText(/lower platform fees on new campaigns, more campaigns, and premium features\. Campaigns you already run keep the fee they were created with\./)).toBeInTheDocument()
  })

  it('states the Free fee for an App Store sandbox plan, which keeps its limits but not its fee or creator donations', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ billingProvider: 'apple', billingEnvironment: 'sandbox', currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    expect(planStat('Platform fee on new campaigns')).toHaveTextContent(/^Platform fee on new campaigns5%$/)
    expect(planStat('Active campaigns')).toHaveTextContent(/^Active campaigns10$/)
    expect(screen.getByText(/This plan is a store test purchase, so new campaigns get the Free plan’s fee\./)).toBeInTheDocument()
    expect(screen.queryByText('Creator profile donations')).not.toBeInTheDocument()
  })

  it('keeps the plan fee and creator donations for a production store plan', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ billingProvider: 'apple', billingEnvironment: 'production', currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    expect(planStat('Platform fee on new campaigns')).toHaveTextContent(/^Platform fee on new campaigns2%$/)
    expect(screen.getByText('Creator profile donations')).toBeInTheDocument()
    expect(screen.queryByText(/test purchase/)).not.toBeInTheDocument()
  })
})

describe('a plan revoked before its period ended', () => {
  it('says it has ended instead of naming a future end date', () => {
    state.plans = LIVE_PLANS
    const end = new Date(Date.now() + 20 * DAY)
    // An App Store refund: EXPIRED, with the period end the plan would have had.
    state.subscription = subscription({ billingProvider: 'apple', status: SubscriptionStatus.EXPIRED, cancelAtPeriodEnd: true, currentPeriodEnd: end })
    mount()
    expect(screen.getByText(/^Your Pro plan has ended\. Free features apply until you buy a plan again\.$/)).toBeInTheDocument()
    expect(planStat('Plan status')).toHaveTextContent(/^Plan statusEnded$/)
    expect(screen.getByText(/^Period: .+ — ended early$/)).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(end.toLocaleDateString().replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')))).not.toBeInTheDocument()
  })

  it('still dates a plan that ended at the end of its period', () => {
    state.plans = LIVE_PLANS
    const end = new Date(Date.now() - DAY)
    state.subscription = subscription({ status: SubscriptionStatus.EXPIRED, currentPeriodEnd: end })
    mount()
    expect(screen.getByText(`Your Pro plan ended on ${end.toLocaleDateString()}. Free features apply until you buy a plan again.`)).toBeInTheDocument()
    expect(planStat('Ended')).toHaveTextContent(end.toLocaleDateString())
  })
})

describe('a store plan the store may still renew', () => {
  const retrying = () => subscription({ billingProvider: 'apple', billingEnvironment: 'production', status: SubscriptionStatus.EXPIRED,
    cancelAtPeriodEnd: false, currentPeriodStart: new Date(Date.now() - 40 * DAY), currentPeriodEnd: new Date(Date.now() - 10 * DAY) })

  it('is managed in the store: banner, no upgrade call to action, no web purchase', () => {
    state.plans = LIVE_PLANS
    state.subscription = retrying()
    mount('/subscription?tier=starter')
    expect(screen.getByText(/^Your App Store subscription has lapsed, but App Store may still renew it\./)).toBeInTheDocument()
    expect(screen.getByText(/Free features apply until App Store renews it\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Upgrade to / })).not.toBeInTheDocument()
    for (const name of ['Choose Starter', 'Choose Pro', 'Choose Organization']) expect(screen.getByRole('button', { name })).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is not once automatic renewal is off, or once the 60-day retry window has passed', () => {
    state.plans = LIVE_PLANS
    state.subscription = { ...retrying(), cancelAtPeriodEnd: true }
    const { unmount } = mount()
    expect(screen.queryByText(/may still renew it/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upgrade to Starter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose Pro' })).toBeEnabled()
    unmount()
    state.subscription = { ...retrying(), currentPeriodEnd: new Date(Date.now() - 61 * DAY) }
    mount()
    expect(screen.queryByText(/may still renew it/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose Pro' })).toBeEnabled()
  })
})

describe('upgrade call to action for a member with a plan in force', () => {
  it('is hidden for an in-force web plan', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    expect(screen.queryByText('Ready to grow your impact?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Upgrade to / })).not.toBeInTheDocument()
  })

  it('is hidden for an in-force store plan', () => {
    state.plans = LIVE_PLANS
    state.subscription = subscription({ billingProvider: 'google', currentPeriodEnd: new Date(Date.now() + 10 * DAY) })
    mount()
    expect(screen.getByText(/billed through Google Play/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Upgrade to / })).not.toBeInTheDocument()
  })
})

describe('checkout dialog while a coupon is being quoted', () => {
  it('waits for the quote of the typed code instead of showing or charging another total', () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    state.couponLoading = true
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Coupon code (optional)'), { target: { value: 'SAVE5' } })
    expect(within(dialog).getByText('Checking…')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Checking coupon…' })).toBeDisabled()
    expect(within(dialog).queryByText(/Coupon applied/)).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Checking coupon…' }))
    expect(checkout).not.toHaveBeenCalled()
  })

  it('does not charge a code it could not check', () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    state.couponError = 'Could not check this coupon'
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Coupon code (optional)'), { target: { value: 'SAVE5' } })
    expect(within(dialog).getByText('Could not check this coupon. Edit the code to try again, or remove it.')).toBeInTheDocument()
    expect(within(dialog).getByText('—')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Continue to payment' })).toBeDisabled()
  })

  it('charges the quoted total once the quote for the typed code is in', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    state.preview = { valid: true, code: 'SAVE5', baseAmount: 29.99, discountAmount: 1.5, finalAmount: 28.49, currency: 'GHS' }
    checkout.mockResolvedValue({ checkout: { id: 'new' }, preview: { finalAmount: 28.49, currency: 'GHS' } })
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Coupon code (optional)'), { target: { value: 'SAVE5' } })
    expect(within(dialog).getByText('GH₵28.49')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue to payment' }))
    await waitFor(() => expect(checkout).toHaveBeenCalledWith(expect.objectContaining({ tier: 'pro', couponCode: 'SAVE5' })))
  })
})

describe('an open payment page of this purchase at an old price', () => {
  it('offers only to cancel it, never to finish or check it', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    const priceChanged = Object.assign(new Error('That payment page charges GH₵26.99, but this purchase now costs GH₵23.99. Cancel it to pay the current price.'),
      { inProgress: 'earlier', priceChanged: true })
    checkout.mockRejectedValueOnce(priceChanged).mockResolvedValueOnce({ checkout: { id: 'new' }, preview: { finalAmount: 23.99, currency: 'GHS' } })
    abandon.mockResolvedValue({ id: 'earlier', status: 'expired' })
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue to payment' }))
    expect(await within(dialog).findByText(/That payment page charges GH₵26\.99, but this purchase now costs GH₵23\.99\./)).toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'Check that payment' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Check that payment' })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel it and continue' }))
    await waitFor(() => expect(checkout).toHaveBeenCalledTimes(2))
    expect(abandon).toHaveBeenCalledWith('earlier')
  })

  it('waits for the edited code\'s total before cancelling and continuing', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    checkout.mockRejectedValueOnce(Object.assign(new Error('That payment page charges GH₵26.99 with a discount that no longer applies. Cancel it to continue.'),
      { inProgress: 'earlier', priceChanged: true }))
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue to payment' }))
    const cancel = await within(dialog).findByRole('button', { name: 'Cancel it and continue' })
    expect(cancel).toBeEnabled()
    // The member types another code; its quote is still on its way.
    state.couponLoading = true
    fireEvent.change(within(dialog).getByLabelText('Coupon code (optional)'), { target: { value: 'SAVE5' } })
    expect(within(dialog).getByRole('button', { name: 'Cancel it and continue' })).toBeDisabled()
    expect(abandon).not.toHaveBeenCalled()
  })

  it('still offers to check a different purchase that is in progress', async () => {
    state.subscription = subscription({ tier: SubscriptionTier.FREE })
    checkout.mockRejectedValueOnce(Object.assign(new Error('You already have a plan payment in progress.'), { inProgress: 'earlier' }))
    mount('/subscription?tier=pro')
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue to payment' }))
    expect(await within(dialog).findByRole('link', { name: 'Check that payment' })).toBeInTheDocument()
  })
})
