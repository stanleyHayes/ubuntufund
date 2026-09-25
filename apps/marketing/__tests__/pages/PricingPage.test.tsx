import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@ubuntu-fund/types'
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
})
