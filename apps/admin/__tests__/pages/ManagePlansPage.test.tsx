vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '@ubuntu-fund/types'
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
