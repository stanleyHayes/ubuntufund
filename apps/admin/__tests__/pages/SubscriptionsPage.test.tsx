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

it('values the production plans (Organization monthly, Enterprise yearly) at the live prices', () => {
  const summary = summarize([sub('a', 'organization'), sub('b', 'enterprise', yearly)], buildPlanMap(LIVE_PLANS), NOW)
  expect(summary.byTier.find(row => row.tier === 'enterprise')?.revenuePesewas).toBe(83333)
  expect(summary.estimatedMrrPesewas).toBe(39900 + 83333)
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
