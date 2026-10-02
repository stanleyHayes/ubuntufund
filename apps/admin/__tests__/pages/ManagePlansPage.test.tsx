vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '@ubuntu-fund/types'
import { ApiError } from '@/lib/apiError'
import { LIVE_PLANS, livePlan } from '../fixtures/livePlans'
const state = vi.hoisted(() => ({ put: vi.fn(), post: vi.fn(), plans: [] as unknown[] }))
vi.mock('@/lib/api', () => ({ api: { put: state.put, post: state.post } }))
vi.mock('@/hooks/useApiData', () => ({ useAdminPlans: () => ({ data: state.plans, isLoading: false, error: null }) }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
import ManagePlansPage from '@/pages/ManagePlansPage'

const pro = { ...(SUBSCRIPTION_PLANS as Record<string, SubscriptionPlan>).pro, name: 'Pro', active: true, isPublic: true, popular: false, sortOrder: 2, accentColor: '#112233' }
beforeEach(() => {
  state.plans = [pro]
  state.put.mockReset().mockImplementation(async (_path: string, body: Partial<SubscriptionPlan>) => ({ ...pro, ...body }))
  state.post.mockReset().mockImplementation(async (_path: string, body: SubscriptionPlan) => body)
})
afterEach(cleanup)

/** A card's detail value (the <dd>), matched on its full text. */
const detail = (text: string) => screen.getByText((_, element) => element?.tagName === 'DD' && element.textContent === text)
const openEdit = async (index = 0) => {
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit plan' })[index])
  return screen.findByRole('dialog')
}

it('lets staff retire, hide, reorder and feature an existing plan', async () => {
  render(<ManagePlansPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit plan' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('switch', { name: 'Active' }))
  fireEvent.click(within(dialog).getByRole('switch', { name: 'Public' }))
  fireEvent.click(within(dialog).getByRole('switch', { name: 'Popular' }))
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Sort order' }), { target: { value: '7' } })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Accent colour' }), { target: { value: '#445566' } })
  expect(within(dialog).getByText(/Existing subscribers are not cancelled/)).toBeVisible()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(state.put).toHaveBeenCalledWith('/plans/pro', expect.objectContaining({ active: false, isPublic: false, popular: true, sortOrder: 7, accentColor: '#445566' })))
  expect(state.put.mock.calls[0][1]).not.toHaveProperty('tier')
})

it('edits the campaigns-on-behalf entitlement, its active limit and its extra fee', async () => {
  render(<ManagePlansPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit plan' }))
  const dialog = await screen.findByRole('dialog')
  const toggle = within(dialog).getByRole('switch', { name: 'Campaigns on behalf of others' })
  expect(toggle).not.toBeChecked()
  fireEvent.click(toggle)
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Active campaigns on behalf of others' }), { target: { value: '5' } })
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Extra fee on those campaigns' }), { target: { value: '2.5' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  // A fee change is confirmed before it is saved.
  const confirm = await screen.findByRole('dialog', { name: 'Confirm Pro pricing' })
  expect(within(confirm).getByText('0% → 2.5%')).toBeVisible()
  fireEvent.click(within(confirm).getByRole('button', { name: 'Confirm and save' }))
  await waitFor(() => expect(state.put).toHaveBeenCalledWith('/plans/pro', expect.objectContaining({ onBehalfCampaigns: true, maxOnBehalfCampaigns: 5, onBehalfFeePercent: 2.5 })))
})

it('refuses an extra fee outside 0–100% without calling the API', async () => {
  render(<ManagePlansPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit plan' }))
  const dialog = await screen.findByRole('dialog')
  const fee = within(dialog).getByRole('spinbutton', { name: 'Extra fee on those campaigns' })
  fireEvent.change(fee, { target: { value: '150' } })
  expect(fee).toHaveAttribute('aria-invalid', 'true')
  expect(within(dialog).getByText('Enter a percentage between 0 and 100.')).toBeVisible()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('The extra fee on campaigns on behalf of others must be between 0 and 100%.')).toBeVisible()
  expect(state.put).not.toHaveBeenCalled()
})

it('refuses an on-behalf limit below -1 without calling the API', async () => {
  render(<ManagePlansPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Edit plan' }))
  const dialog = await screen.findByRole('dialog')
  const limit = within(dialog).getByRole('spinbutton', { name: 'Active campaigns on behalf of others' })
  fireEvent.change(limit, { target: { value: '-2' } })
  expect(limit).toHaveAttribute('aria-invalid', 'true')
  expect(within(dialog).getByText('Use a whole number, or -1 for unlimited.')).toBeVisible()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Active campaigns on behalf of others must be a whole number, or -1 for unlimited.')).toBeVisible()
  expect(state.put).not.toHaveBeenCalled()
})

it('creates a new plan with campaigns on behalf of others switched on', async () => {
  render(<ManagePlansPage />)
  fireEvent.click(screen.getByRole('button', { name: 'New plan' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('switch', { name: 'Campaigns on behalf of others' })).not.toBeChecked()
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Tier id' }), { target: { value: 'ngo' } })
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), { target: { value: 'NGO' } })
  fireEvent.click(within(dialog).getByRole('switch', { name: 'Campaigns on behalf of others' }))
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Active campaigns on behalf of others' }), { target: { value: '-1' } })
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Extra fee on those campaigns' }), { target: { value: '1' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create plan' }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/plans', expect.objectContaining({ tier: 'ngo', name: 'NGO', onBehalfCampaigns: true, maxOnBehalfCampaigns: -1, onBehalfFeePercent: 1 })))
})

it('shows the on-behalf limit and fee on a plan that includes them', () => {
  state.plans = [{ ...pro, onBehalfCampaigns: true, maxOnBehalfCampaigns: -1, onBehalfFeePercent: 1.5 }]
  render(<ManagePlansPage />)
  expect(screen.getByText('Unlimited active · +1.5% fee')).toBeVisible()
  expect(screen.getByText('Campaigns on behalf of others')).toBeVisible()
})

it('formats card prices with one grouped formatter and the yearly price per month, in plan order', () => {
  state.plans = [...LIVE_PLANS].reverse()
  render(<ManagePlansPage />)
  expect(screen.getAllByRole('heading', { level: 6 }).map((heading) => heading.textContent)).toEqual(['Free', 'Starter', 'Pro', 'Organization', 'Enterprise'])
  expect(screen.getByText('GH₵ 9.99/mo')).toBeVisible()
  expect(screen.getByText('GH₵ 399/mo')).toBeVisible()
  expect(screen.getByText('GH₵ 999.99/mo')).toBeVisible()
  expect(detail('GH₵ 99/yr · ≈ GH₵ 8.25/mo · 17.4% below 12 × monthly')).toBeVisible()
  expect(detail('GH₵ 3,990/yr · ≈ GH₵ 332.50/mo · 16.7% below 12 × monthly')).toBeVisible()
  expect(detail('GH₵ 9,999.90/yr · ≈ GH₵ 833.33/mo · 16.7% below 12 × monthly')).toBeVisible()
  expect(detail('GH₵ 1,000,000')).toBeVisible()
  // Only Enterprise is sold by the sales team, and only Free is free.
  expect(screen.getAllByText('Sales only')).toHaveLength(1)
  expect(screen.getByText('Reference price, not sold at web checkout.')).toBeVisible()
  expect(screen.getAllByText('Paid')).toHaveLength(4)
  expect(screen.getByText('Paid tiers').parentElement).toHaveTextContent('4')
})

it('reads a zero cycle on a paid plan as not offered and still counts the plan as paid', () => {
  state.plans = [
    { ...livePlan('starter'), tier: 'yearly-only', name: 'Yearly only', priceMonthly: 0 },
    { ...livePlan('pro'), tier: 'monthly-only', name: 'Monthly only', priceYearly: 0 },
  ]
  render(<ManagePlansPage />)
  expect(screen.getByText('Monthly not offered')).toBeVisible()
  expect(detail('GH₵ 99/yr · ≈ GH₵ 8.25/mo · monthly not offered')).toBeVisible()
  expect(detail('Not offered')).toBeVisible()
  expect(screen.queryByText('Free')).toBeNull()
  expect(screen.getByText('Paid tiers').parentElement).toHaveTextContent('2')
})

it('confirms every changed price and fee, old → new, before saving', async () => {
  state.plans = [{ ...livePlan('enterprise'), priceMonthly: 99.99, priceYearly: 999, maxOnBehalfCampaigns: -1 }]
  render(<ManagePlansPage />)
  const dialog = await openEdit()
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Monthly price' }), { target: { value: '999.99' } })
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Yearly price' }), { target: { value: '9999.9' } })
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Platform fee' }), { target: { value: '1.25' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  let confirm = await screen.findByRole('dialog', { name: 'Confirm Enterprise pricing' })
  expect(within(confirm).getByText('GH₵ 99.99 → GH₵ 999.99 (+900.1%)')).toBeVisible()
  expect(within(confirm).getByText('GH₵ 999 → GH₵ 9,999.90 (+901%)')).toBeVisible()
  expect(within(confirm).getByText('1% → 1.25% (+25%)')).toBeVisible()
  expect(state.put).not.toHaveBeenCalled()

  fireEvent.click(within(confirm).getByRole('button', { name: 'Back' }))
  const edit = await screen.findByRole('dialog', { name: 'Edit Enterprise plan' })
  expect(screen.queryByRole('dialog', { name: 'Confirm Enterprise pricing' })).toBeNull()
  expect(state.put).not.toHaveBeenCalled()

  fireEvent.click(within(edit).getByRole('button', { name: 'Save changes' }))
  confirm = await screen.findByRole('dialog', { name: 'Confirm Enterprise pricing' })
  fireEvent.click(within(confirm).getByRole('button', { name: 'Confirm and save' }))
  await waitFor(() => expect(state.put).toHaveBeenCalledWith('/plans/enterprise', expect.objectContaining({ priceMonthly: 999.99, priceYearly: 9999.9, platformFeePercent: 1.25 })))
})

it('blocks prices below 0, above 1,000,000 or with more than two decimals', async () => {
  state.plans = [livePlan('organization')]
  render(<ManagePlansPage />)
  const dialog = await openEdit()
  const monthly = within(dialog).getByRole('spinbutton', { name: 'Monthly price' })
  expect(monthly).toHaveAttribute('min', '0')
  expect(monthly).toHaveAttribute('max', '1000000')
  expect(monthly).toHaveAttribute('step', '0.01')
  fireEvent.change(monthly, { target: { value: '9.999' } })
  expect(monthly).toHaveAttribute('aria-invalid', 'true')
  expect(within(dialog).getByText('Use 0 to 1,000,000, with at most two decimal places.')).toBeVisible()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Prices must be 0 to 1,000,000, with at most two decimal places.')).toBeVisible()
  fireEvent.change(monthly, { target: { value: '-1' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  // One zero too many: the API refuses it, so the dialog does too, before the confirm step.
  fireEvent.change(monthly, { target: { value: '1500000' } })
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Yearly price' }), { target: { value: '0' } })
  expect(monthly).toHaveAttribute('aria-invalid', 'true')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  expect(screen.queryByRole('dialog', { name: 'Confirm Organization pricing' })).toBeNull()
  expect(state.put).not.toHaveBeenCalled()
})

it('names each field the API refused when a save fails validation', async () => {
  state.put.mockRejectedValue(new ApiError('Validation failed', 400, { accentColor: ['Must be a hex colour'], maxTeamMembers: ['Expected integer, received float'] }))
  render(<ManagePlansPage />)
  const dialog = await openEdit()
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Accent colour' }), { target: { value: 'blue' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Validation failed. Accent colour: Must be a hex colour. Organization team seats (incl. owner): Expected integer, received float.')).toBeVisible()
})

it('warns in both dialogs when another plan already uses the sort order', async () => {
  state.plans = [...LIVE_PLANS]
  render(<ManagePlansPage />)
  const edit = await openEdit(4)
  expect(within(edit).getByRole('heading', { name: 'Edit Enterprise plan' })).toBeVisible()
  expect(within(edit).getByText('Organization also uses 3; ties are ordered by monthly price, then tier id.')).toBeVisible()
  fireEvent.change(within(edit).getByRole('spinbutton', { name: 'Sort order' }), { target: { value: '4' } })
  expect(within(edit).queryByText(/ties are ordered by monthly price/)).toBeNull()
  fireEvent.click(within(edit).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

  fireEvent.click(screen.getByRole('button', { name: 'New plan' }))
  const create = await screen.findByRole('dialog', { name: 'Create new plan' })
  expect(within(create).queryByText(/ties are ordered by monthly price/)).toBeNull()
  fireEvent.change(within(create).getByRole('spinbutton', { name: 'Sort order' }), { target: { value: '2' } })
  expect(within(create).getByText('Pro also uses 2; ties are ordered by monthly price, then tier id.')).toBeVisible()
})

it('says the code defaults never change an existing plan, edited or not', () => {
  render(<ManagePlansPage />)
  expect(screen.getByText(/The code-defined defaults only add built-in tiers that are missing; they never change a plan that already exists, whether or not it was edited here\./)).toBeVisible()
})

it('shows the yearly price per month under Yearly, and flags a yearly price that saves nothing', async () => {
  state.plans = [livePlan('starter')]
  render(<ManagePlansPage />)
  const dialog = await openEdit()
  expect(within(dialog).getByText('≈ GH₵ 8.25/mo · 17.4% below 12 × monthly')).toBeVisible()
  const yearly = within(dialog).getByRole('spinbutton', { name: 'Yearly price' })
  fireEvent.change(yearly, { target: { value: '119.88' } })
  expect(within(dialog).getByText('≈ GH₵ 9.99/mo · same as 12 × monthly, so yearly saves nothing')).toBeVisible()
  expect(yearly).not.toHaveAttribute('aria-invalid', 'true')
  // One pesewa above 12 × monthly is refused, and the note gives the amount rather than a rounded '0%'.
  fireEvent.change(yearly, { target: { value: '119.89' } })
  expect(within(dialog).getByText('≈ GH₵ 9.99/mo · GH₵ 0.01 above 12 × monthly (GH₵ 119.88), so yearly costs more')).toBeVisible()
  expect(yearly).toHaveAttribute('aria-invalid', 'true')
  fireEvent.change(yearly, { target: { value: '200' } })
  expect(within(dialog).getByText('≈ GH₵ 16.67/mo · 66.8% above 12 × monthly, so yearly costs more')).toBeVisible()
  expect(yearly).toHaveAttribute('aria-invalid', 'true')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText(/The yearly price is more than 12 × the monthly price \(GH₵ 119.88\)/)).toBeVisible()
  expect(state.put).not.toHaveBeenCalled()
})

it('flags on-behalf switched on with 0 allowed on the card and in the dialog, and will not save it', async () => {
  state.plans = [livePlan('enterprise')]
  render(<ManagePlansPage />)
  expect(screen.getByText('Switched on, but 0 allowed: nobody on this plan can start one.').closest('[role="alert"]')).toBeVisible()
  const dialog = await openEdit()
  const limit = within(dialog).getByRole('spinbutton', { name: 'Active campaigns on behalf of others' })
  expect(limit).toHaveAttribute('aria-invalid', 'true')
  expect(within(dialog).getByText('Switched on, but 0 allowed: nobody on this plan can start one.')).toBeVisible()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText(/Set a limit, -1 for unlimited, or switch it off\./)).toBeVisible()
  expect(state.put).not.toHaveBeenCalled()
})

it('makes the on-behalf limit unlimited when the feature is switched on at 0', async () => {
  state.plans = [livePlan('organization')]
  render(<ManagePlansPage />)
  const dialog = await openEdit()
  const limit = within(dialog).getByRole('spinbutton', { name: 'Active campaigns on behalf of others' })
  expect(limit).toHaveValue(0)
  fireEvent.click(within(dialog).getByRole('switch', { name: 'Campaigns on behalf of others' }))
  expect(limit).toHaveValue(-1)
  expect(limit).not.toHaveAttribute('aria-invalid', 'true')
})

it('explains which campaigns a platform fee change reprices', async () => {
  render(<ManagePlansPage />)
  const dialog = await openEdit()
  expect(within(dialog).getByText('Between 0 and 100. Locked onto each campaign when it is created (existing campaigns keep their rate); creator-page withdrawals use the current rate.')).toBeVisible()
})
