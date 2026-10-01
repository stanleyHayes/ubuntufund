import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { SUBSCRIPTION_PLANS, SubscriptionTier, type SubscriptionPlan } from '@ubuntu-fund/types'
import PricingPage from '@/pages/PricingPage'

afterEach(() => { vi.unstubAllGlobals() })

function renderWith(plans: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: plans }), { status: 200 })))
  return render(
    <ThemeProvider theme={ujimoraTheme}>
      <MemoryRouter initialEntries={['/pricing']}>
        <PricingPage />
      </MemoryRouter>
    </ThemeProvider>
  )
}
const card = (name: string) => screen.getAllByText(name).map((node) => node.closest('.MuiCard-root') as HTMLElement).find(Boolean)!
/** The plan cells of a comparison-table row, in column order. */
const rowCells = (label: string) => Array.from(within(screen.getByRole('region', { name: 'Plan comparison' })).getByText(label).parentElement!.parentElement!.children).slice(1) as HTMLElement[]

// Production rows written before a field existed simply lack it (today:
// maxCollaboratorsPerCampaign on Free, Starter, Pro and Enterprise).
function legacyRow(plan: SubscriptionPlan, over: Partial<SubscriptionPlan>): SubscriptionPlan {
  const { maxCollaboratorsPerCampaign: _missing, ...row } = { ...plan, ...over }
  return row as SubscriptionPlan
}
/** GET /plans/public as of 2026-09-30 (legacy and v6 prices mixed), in API order. */
const LIVE_PLANS: SubscriptionPlan[] = [
  legacyRow(SUBSCRIPTION_PLANS.free, { name: 'Free', platformFeePercent: 5, maxCampaignGoal: 5000, popular: false }),
  legacyRow(SUBSCRIPTION_PLANS.starter, { name: 'Starter', priceMonthly: 9.99, priceYearly: 99, platformFeePercent: 3.5, popular: false }),
  legacyRow(SUBSCRIPTION_PLANS.pro, { priceMonthly: 29.99, priceYearly: 299, platformFeePercent: 2, campaignCollaboration: false, popular: false }),
  { ...SUBSCRIPTION_PLANS.organization, onBehalfCampaigns: false, popular: false },
  legacyRow(SUBSCRIPTION_PLANS.enterprise, { priceMonthly: 999.99, priceYearly: 9999.9, platformFeePercent: 1, sortOrder: 3, maxOnBehalfCampaigns: 0, popular: false }),
]

describe('PricingPage plan cards', () => {
  it('does not show a yearly-only paid plan as a free GH₵ 0 plan on the monthly toggle', async () => {
    const plans = [
      SUBSCRIPTION_PLANS[SubscriptionTier.FREE],
      { ...SUBSCRIPTION_PLANS[SubscriptionTier.PRO], priceMonthly: 0, priceYearly: 1490 },
    ]
    renderWith(plans)
    await screen.findAllByText(SUBSCRIPTION_PLANS[SubscriptionTier.PRO].name)
    const pro = card(SUBSCRIPTION_PLANS[SubscriptionTier.PRO].name)
    expect(within(pro).getAllByText('Monthly not offered').length).toBeGreaterThan(0)
    expect(within(pro).queryByText('Get Started Free')).not.toBeInTheDocument()
    expect(within(pro).queryByRole('link')).not.toBeInTheDocument()
    // Free is still free, by tier.
    const free = card(SUBSCRIPTION_PLANS[SubscriptionTier.FREE].name)
    expect(within(free).getByRole('link', { name: 'Get Started Free' })).toBeInTheDocument()
    // The yearly toggle sells it.
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(within(card(SUBSCRIPTION_PLANS[SubscriptionTier.PRO].name)).getByRole('link', { name: `Choose ${SUBSCRIPTION_PLANS[SubscriptionTier.PRO].name}` })).toBeInTheDocument()
  })

  it('lists campaigns on behalf of others only for plans that include them', async () => {
    const plans = Object.values(SUBSCRIPTION_PLANS)
    renderWith(plans)
    const organization = SUBSCRIPTION_PLANS[SubscriptionTier.ORGANIZATION]
    await screen.findAllByText(organization.name)
    expect(within(card(organization.name)).getByText('Campaigns on behalf of others')).toBeInTheDocument()
    expect(within(card(SUBSCRIPTION_PLANS[SubscriptionTier.PRO].name)).queryByText('Campaigns on behalf of others')).not.toBeInTheDocument()
    // The comparison row follows each plan's flag, so admins can change it without a deploy.
    const label = within(screen.getByRole('region', { name: 'Plan comparison' })).getByText('Campaigns on behalf of others')
    const row = label.parentElement!.parentElement!
    const included = plans.filter((plan) => plan.onBehalfCampaigns).length
    expect(within(row).getAllByTestId('CheckRoundedIcon')).toHaveLength(included)
    expect(within(row).getAllByTestId('CloseRoundedIcon')).toHaveLength(plans.length - included)
  })
})

describe('PricingPage with the live plan rows', () => {
  it('never renders undefined, null or NaN, on either billing cycle', async () => {
    renderWith(LIVE_PLANS)
    await screen.findAllByText('Starter')
    expect(document.body.textContent).not.toMatch(/undefined|null|NaN/)
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(document.body.textContent).not.toMatch(/undefined|null|NaN/)
  })

  it('shows ✗ for collaborators without collaboration, the cap when set, and — when unstated', async () => {
    renderWith(LIVE_PLANS)
    await screen.findAllByText('Starter')
    const [free, starter, pro, organization, enterprise] = rowCells('Collaborators per campaign')
    for (const cell of [free, starter, pro]) expect(within(cell).getByTestId('CloseRoundedIcon')).toBeInTheDocument()
    expect(organization).toHaveTextContent(/^10$/)
    expect(within(enterprise).getByRole('img', { name: 'Not specified' })).toHaveTextContent('—')
  })

  it('shows Unlimited for a -1 collaborator cap', async () => {
    renderWith(Object.values(SUBSCRIPTION_PLANS))
    await screen.findAllByText(SUBSCRIPTION_PLANS[SubscriptionTier.ENTERPRISE].name)
    expect(rowCells('Collaborators per campaign').map((cell) => cell.textContent)).toEqual(['', '', '3', '10', 'Unlimited'])
  })

  it('formats prices as the app does: GH₵9.99, GH₵332.50 a month and GH₵3,990 a year', async () => {
    renderWith(LIVE_PLANS)
    await screen.findAllByText('Starter')
    expect(within(card('Starter')).getByText('GH₵9.99')).toBeInTheDocument()
    expect(within(card('Organization')).getByText('GH₵399')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(within(card('Starter')).getByText('GH₵8.25')).toBeInTheDocument()
    expect(within(card('Organization')).getByText('GH₵332.50')).toBeInTheDocument()
    expect(within(card('Organization')).getByText(/^GH₵3,990 for 1 year/)).toBeInTheDocument()
  })

  it('hands the chosen plan and billing cycle to the web checkout', async () => {
    renderWith(LIVE_PLANS)
    await screen.findAllByText('Starter')
    expect(within(card('Starter')).getByRole('link', { name: 'Choose Starter' }))
      .toHaveAttribute('href', expect.stringMatching(/\/subscription\?tier=starter&billingCycle=monthly$/))
    fireEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(within(card('Organization')).getByRole('link', { name: 'Choose Organization' }))
      .toHaveAttribute('href', expect.stringMatching(/\/subscription\?tier=organization&billingCycle=yearly$/))
  })

  it('orders plans by sortOrder, then price, then tier id, whatever the API order', async () => {
    const columns = () => Array.from(within(screen.getByRole('region', { name: 'Plan comparison' })).getByText('Feature')
      .parentElement!.parentElement!.children).slice(1).map((cell) => cell.textContent)
    const reversed = renderWith([...LIVE_PLANS].reverse())
    await screen.findAllByText('Starter')
    // Organization and Enterprise share sortOrder 3; the lower price comes first.
    expect(columns()).toEqual(['Free', 'Starter', 'Pro', 'Organization', 'Enterprise'])
    reversed.unmount()
    // Same sortOrder and price: the tier id decides, in either API order.
    const tied = LIVE_PLANS.map((plan) => plan.tier === SubscriptionTier.ENTERPRISE ? { ...plan, priceMonthly: 399 } : plan)
    for (const plans of [tied, [...tied].reverse()]) {
      const view = renderWith(plans)
      await screen.findAllByText('Starter')
      expect(columns()).toEqual(['Free', 'Starter', 'Pro', 'Enterprise', 'Organization'])
      view.unmount()
    }
  })

  it('names the free plan in the intro and the FAQ as the live plans do', async () => {
    renderWith(LIVE_PLANS)
    await screen.findAllByText('Starter')
    expect(screen.getByText(/Free does not include creator donations\.$/)).toBeInTheDocument()
    expect(screen.getByText(/You can start with the Free plan without a paid subscription/)).toBeInTheDocument()
    expect(screen.getByText(/your account moves to Free features/)).toBeInTheDocument()
    expect(screen.queryByText(/Community (plan|features)/)).not.toBeInTheDocument()
  })

  it('follows a renamed free plan in the copy as well as on its card', async () => {
    renderWith(LIVE_PLANS.map((plan) => plan.tier === SubscriptionTier.FREE ? { ...plan, name: 'Community' } : plan))
    await screen.findAllByText('Starter')
    expect(within(card('Community')).getByRole('link', { name: 'Get Started Free' })).toBeInTheDocument()
    expect(screen.getByText(/Community does not include creator donations\.$/)).toBeInTheDocument()
    expect(screen.getByText(/You can start with the Community plan/)).toBeInTheDocument()
    expect(screen.getByText(/your account moves to Community features/)).toBeInTheDocument()
    expect(screen.queryByText(/Free (does not include|plan without|features)/)).not.toBeInTheDocument()
  })
})
