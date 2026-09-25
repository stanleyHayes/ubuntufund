vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SUBSCRIPTION_PLANS, type Subscription, type SubscriptionPlan } from '@ubuntu-fund/types'
const state = vi.hoisted(() => ({ rows: [] as unknown[], plans: [] as unknown[] }))
vi.mock('@/lib/exports/loadAll', () => ({ loadAll: async () => state.rows }))
vi.mock('@/hooks/useApiData', () => ({ useAdminPlans: () => ({ data: state.plans, isLoading: false, error: null }) }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
import SubscriptionsPage from '@/pages/SubscriptionsPage'
import { buildPlanMap, summarize } from '@/lib/subscriptionMetrics'

// Relative to the real clock: the page decides "lapsed" against the current time.
const NOW = new Date()
const future = new Date(NOW.getTime() + 30 * 86400000).toISOString(), past = new Date(NOW.getTime() - 30 * 86400000).toISOString()
const seed = SUBSCRIPTION_PLANS as Record<string, SubscriptionPlan>
const sub = (id: string, tier: string, overrides: Partial<Subscription> = {}) => ({
  id, userId: `u-${id}`, userName: `Member ${id}`, email: `${id}@example.test`, tier, status: 'active', billingCycle: 'monthly',
  currentPeriodStart: past, currentPeriodEnd: future, cancelAtPeriodEnd: false, createdAt: past, updatedAt: past, ...overrides,
}) as Subscription & { userName: string; email: string }
const renamedPro = { ...seed.pro, name: 'Pro Studio', priceMonthly: 100, priceYearly: 1200 }
const custom = { ...seed.pro, tier: 'harvest', name: 'Harvest Circle', priceMonthly: 40, priceYearly: 480, accentColor: '#123456', active: true }

beforeEach(() => { state.plans = [renamedPro, custom]; state.rows = [] })
afterEach(cleanup)

it('prices only currently paid web subscriptions at live list prices and counts store billing separately', () => {
  const plans = buildPlanMap([renamedPro, custom] as SubscriptionPlan[])
  const summary = summarize([
    sub('a', 'pro'),
    sub('b', 'harvest', { billingCycle: 'yearly' as Subscription['billingCycle'] }),
    sub('c', 'pro', { currentPeriodEnd: new Date(past) }),
    sub('d', 'pro', { billingProvider: 'apple' }),
    sub('e', 'free'),
  ], plans, NOW)
  expect(summary).toMatchObject({ total: 5, paid: 3, free: 2, storeBilledPaid: 1, estimatedMrr: 140 })
  expect(summary.byTier.find(row => row.tier === 'harvest')).toMatchObject({ name: 'Harvest Circle', count: 1, revenue: 40 })
  expect(summary.byTier.find(row => row.tier === 'pro')).toMatchObject({ name: 'Pro Studio', count: 2, revenue: 100 })
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
