vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from '@ubuntu-fund/types'
const state = vi.hoisted(() => ({ put: vi.fn(), plans: [] as unknown[] }))
vi.mock('@/lib/api', () => ({ api: { put: state.put, post: vi.fn() } }))
vi.mock('@/hooks/useApiData', () => ({ useAdminPlans: () => ({ data: state.plans, isLoading: false, error: null }) }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
import ManagePlansPage from '@/pages/ManagePlansPage'

const pro = { ...(SUBSCRIPTION_PLANS as Record<string, SubscriptionPlan>).pro, name: 'Pro', active: true, isPublic: true, popular: false, sortOrder: 2, accentColor: '#112233' }
beforeEach(() => {
  state.plans = [pro]
  state.put.mockReset().mockImplementation(async (_path: string, body: Partial<SubscriptionPlan>) => ({ ...pro, ...body }))
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
