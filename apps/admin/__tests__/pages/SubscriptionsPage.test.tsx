vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Subscription, SubscriptionPlan } from '@ubuntu-fund/types'
import { LIVE_PLANS, livePlan } from '../fixtures/livePlans'
const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  plans: { data: [] as unknown[], isLoading: false, error: null as string | null, retry: () => {} },
}))
vi.mock('@/lib/exports/loadAll', () => ({ loadAll: async () => state.rows }))
vi.mock('@/hooks/useApiData', () => ({ useAdminPlans: () => state.plans }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
import SubscriptionsPage from '@/pages/SubscriptionsPage'
import { buildPlanMap, knownTiers, summarize } from '@/lib/subscriptionMetrics'
import { STATUS_TEXT_COLOR, tierHue } from '@/lib/subscriptionTones'

// Relative to the real clock: the page decides "lapsed" against the current time.
const NOW = new Date()
const future = new Date(NOW.getTime() + 30 * 86400000).toISOString(), past = new Date(NOW.getTime() - 30 * 86400000).toISOString()
const sub = (id: string, tier: string, overrides: Partial<Subscription> = {}) => ({
  id, userId: `u-${id}`, userName: `Member ${id}`, email: `${id}@example.test`, tier, status: 'active', billingCycle: 'monthly',
  currentPeriodStart: past, currentPeriodEnd: future, cancelAtPeriodEnd: false, createdAt: past, updatedAt: past, ...overrides,
}) as Subscription & { userName: string; email: string }
const yearly = { billingCycle: 'yearly' as Subscription['billingCycle'] }
const renamedPro = { ...livePlan('pro'), name: 'Pro Studio', priceMonthly: 100, priceYearly: 1200 }
const custom = { ...livePlan('pro'), tier: 'harvest', name: 'Harvest Circle', priceMonthly: 40, priceYearly: 480, accentColor: '#123456', active: true }
const plansState = (over: Partial<typeof state.plans> = {}) => ({ data: [renamedPro, custom] as unknown[], isLoading: false, error: null, retry: vi.fn(), ...over })
/** The value shown for a header statistic, found by its label. */
const stat = (label: string) => screen.getByText(label).parentElement as HTMLElement

beforeEach(() => { state.plans = plansState(); state.rows = [] })
afterEach(cleanup)

it('prices only currently paid web subscriptions at live list prices and counts store billing separately', () => {
  const plans = buildPlanMap([renamedPro, custom] as SubscriptionPlan[])
  const summary = summarize([
    sub('a', 'pro'),
    sub('b', 'harvest', yearly),
    sub('c', 'pro', { currentPeriodEnd: new Date(past) }),
    sub('d', 'pro', { billingProvider: 'apple' }),
    sub('e', 'free'),
  ], plans, NOW)
  expect(summary).toMatchObject({ total: 5, paid: 3, free: 2, storeBilledPaid: 1, estimatedMrrPesewas: 14000 })
  expect(summary.byTier.find(row => row.tier === 'harvest')).toMatchObject({ name: 'Harvest Circle', count: 1, revenuePesewas: 4000 })
  expect(summary.byTier.find(row => row.tier === 'pro')).toMatchObject({ name: 'Pro Studio', count: 2, revenuePesewas: 10000 })
})

it('never prices or names subscriptions from the code seed', () => {
  expect(buildPlanMap([])).toEqual({})
  const summary = summarize([sub('a', 'starter'), sub('b', 'enterprise', yearly)], buildPlanMap([]), NOW)
  expect(summary.estimatedMrrPesewas).toBe(0)
  expect(summary.byTier.map(row => row.name)).toEqual(['enterprise', 'starter'])
})

it('orders tiers by sort order, then price, then tier id, then tiers with no live plan', () => {
  const plans = buildPlanMap([...LIVE_PLANS].reverse())
  expect(knownTiers(plans, [sub('a', 'legacy'), sub('b', 'pro')])).toEqual(['free', 'starter', 'pro', 'organization', 'enterprise', 'legacy'])
})

it('estimates MRR in pesewas, so the header equals the sum of the tier cards', async () => {
  const rows = [sub('a', 'starter'), sub('b', 'pro'), sub('c', 'organization', yearly)]
  const summary = summarize(rows, buildPlanMap(LIVE_PLANS), NOW)
  expect(summary.estimatedMrrPesewas).toBe(999 + 2999 + 33250)
  expect(summary.estimatedMrrPesewas).toBe(summary.byTier.reduce((sum, row) => sum + row.revenuePesewas, 0))

  state.plans = plansState({ data: LIVE_PLANS })
  state.rows = rows
  render(<MemoryRouter><SubscriptionsPage /></MemoryRouter>)
  expect(await screen.findByText('GH₵ 9.99/mo')).toBeVisible()
  expect(screen.getByText('GH₵ 29.99/mo')).toBeVisible()
  expect(screen.getByText('GH₵ 332.50/mo')).toBeVisible()
  expect(stat('Estimated MRR (list price)')).toHaveTextContent('GH₵ 372.48')
})

it('counts sales-only Enterprise subscribers without pricing them at the reference price', () => {
  // Production on 2026-09-30: Organization monthly, and an Enterprise yearly plan that paid GH₵ 999,
  // not the 9,999.90 reference price (GH₵ 833.33 a month) Admin → Plans shows.
  const summary = summarize([sub('a', 'organization'), sub('b', 'enterprise', yearly)], buildPlanMap(LIVE_PLANS), NOW)
  expect(summary.byTier.find(row => row.tier === 'enterprise')).toMatchObject({ count: 1, negotiated: true, revenuePesewas: 0 })
  expect(summary.byTier.find(row => row.tier === 'organization')).toMatchObject({ count: 1, negotiated: false, revenuePesewas: 39900 })
  expect(summary).toMatchObject({ paid: 2, negotiatedPaid: 1, estimatedMrrPesewas: 39900 })
})

it('still prices a plan taken off public sale at list, since its members bought it at checkout', () => {
  // Starter sold at GH₵9.99 through Paystack; an admin then switched its Public off.
  const plans = buildPlanMap(LIVE_PLANS.map(plan => (plan.tier === 'starter' ? { ...plan, isPublic: false } : plan)))
  const hidden = summarize([sub('a', 'starter'), sub('b', 'starter')], plans, NOW)
  expect(hidden).toMatchObject({ negotiatedPaid: 0, estimatedMrrPesewas: 1998 })
  expect(hidden.byTier.find(row => row.tier === 'starter')).toMatchObject({ count: 2, negotiated: false, notOnPublicSale: true, revenuePesewas: 1998 })
  expect(hidden.byTier.find(row => row.tier === 'pro')).toMatchObject({ notOnPublicSale: false })
})

it('shows a hidden plan priced at list with a note, and no negotiated-price claim', async () => {
  state.plans = plansState({ data: LIVE_PLANS.map(plan => (plan.tier === 'starter' ? { ...plan, isPublic: false } : plan)) })
  state.rows = [sub('a', 'starter')]
  render(<MemoryRouter><SubscriptionsPage /></MemoryRouter>)
  expect(await screen.findByText('GH₵ 9.99/mo')).toBeVisible()
  expect(screen.getByText('Not on public sale · priced at list')).toBeVisible()
  expect(stat('Estimated MRR (list price)')).toHaveTextContent('GH₵ 9.99')
  // Only Enterprise's card reads Negotiated.
  expect(screen.getAllByText('Negotiated')).toHaveLength(1)
  expect(screen.getByText('Not on public sale · priced at list').parentElement).toHaveTextContent(/^StarterGH₵ 9\.99\/mo1 subscriberNot on public sale · priced at list$/)
  expect(screen.queryByText(/not sold at web checkout and not priced here/)).toBeNull()
  expect(screen.queryByText(/negotiated price/)).toBeNull()
})

it('writes tier names and status words in AA text colours, with one hue per tier for its dot and bar', () => {
  // Status words use the theme tokens that clear 4.5:1 in every skin and mode.
  for (const color of Object.values(STATUS_TEXT_COLOR)) expect(color).toMatch(/^(var\(--text-(success|info|warning|error)\)|text\.secondary)$/)
  // A custom tier's hue is its own accent colour, on the row and on its card alike.
  const plans = buildPlanMap([custom] as SubscriptionPlan[])
  expect(tierHue('harvest', plans)).toBe('#123456')
  expect(tierHue('unknown', plans)).toBe('#78909C')
})

it('shows a sales-only tier as negotiated and leaves it out of the estimate', async () => {
  state.plans = plansState({ data: LIVE_PLANS })
  state.rows = [sub('a', 'organization'), sub('b', 'enterprise', yearly)]
  render(<MemoryRouter><SubscriptionsPage /></MemoryRouter>)
  expect(await screen.findByText('Negotiated')).toBeVisible()
  expect(screen.getByText('GH₵ 399.00/mo')).toBeVisible()
  expect(stat('Estimated MRR (list price)')).toHaveTextContent('GH₵ 399.00')
  expect(screen.getByText(/1 paying subscriber is on a plan not sold at web checkout and not priced here\./)).toBeVisible()
  expect(screen.queryByText(/833/)).toBeNull()
})

it('shows an unavailable estimate and a retry, never seed figures, when plans fail to load', async () => {
  const retry = vi.fn()
  state.plans = plansState({ data: [], error: 'The server could not complete this request.', retry })
  state.rows = [sub('a', 'pro')]
  render(<MemoryRouter><SubscriptionsPage /></MemoryRouter>)
  expect(await screen.findByText(/Plan prices could not be loaded/)).toBeVisible()
  expect(stat('Estimated MRR (list price)')).toHaveTextContent('—')
  expect(stat('Estimated MRR (list price)')).not.toHaveTextContent('GH₵')
  // The tier card keeps its subscriber count but shows no amount, and the tier's id rather than a seed name.
  expect(screen.getByText('—', { selector: 'p' })).toBeVisible()
  expect(screen.getAllByText('pro').length).toBeGreaterThan(0)
  expect(screen.queryByText('Pro')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledTimes(1)
})

it('shows skeletons, not guessed names or prices, while plans load', async () => {
  state.plans = plansState({ data: [], isLoading: true })
  state.rows = [sub('a', 'pro')]
  render(<MemoryRouter><SubscriptionsPage /></MemoryRouter>)
  expect(await screen.findByText('1 subscription')).toBeVisible()
  expect(stat('Estimated MRR (list price)').textContent).toBe('Estimated MRR (list price)')
  expect(screen.queryByText(/GH₵/)).toBeNull()
  expect(screen.queryByText(/^pro$/i)).toBeNull()
  expect(screen.getAllByRole('combobox')[0]).toHaveAttribute('aria-disabled', 'true')
})

it('shows renamed and custom plan names, flags lapsed rows and has no dead subscription controls', async () => {
  state.rows = [sub('a', 'pro'), sub('b', 'harvest'), sub('c', 'pro', { currentPeriodEnd: new Date(past) })]
  render(<MemoryRouter><SubscriptionsPage /></MemoryRouter>)
  expect((await screen.findAllByText('Pro Studio')).length).toBeGreaterThan(0)
  expect(screen.getAllByText('Harvest Circle').length).toBeGreaterThan(0)
  expect(screen.getByText(/period ended/)).toBeInTheDocument()
  expect(screen.getByText('Estimated MRR (list price)')).toBeVisible()
  expect(screen.queryByRole('button', { name: /^Tier$/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Cancel$/ })).toBeNull()
})
