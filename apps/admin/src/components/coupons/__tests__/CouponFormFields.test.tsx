import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import CouponFormFields from '../CouponFormFields'
import { type CouponPlans, emptyForm } from '../couponForm'
import { buildPlanMap } from '@/lib/subscriptionMetrics'
import { LIVE_PLANS, livePlan } from '../../../../__tests__/fixtures/livePlans'

afterEach(cleanup)

function Picker({ plans, tiers = [], savedTiers, editing }: { plans: CouponPlans; tiers?: string[]; savedTiers?: string[]; editing?: boolean }) {
  const [form, setForm] = useState({ ...emptyForm, appliesToTiers: tiers })
  return <ThemeProvider theme={ujimoraTheme}><CouponFormFields form={form} setForm={setForm} step={1} plans={plans} savedTiers={savedTiers} editing={editing} /></ThemeProvider>
}
const live = (over: Partial<CouponPlans> = {}): CouponPlans => ({ byTier: buildPlanMap(LIVE_PLANS), isLoading: false, error: null, retry: vi.fn(), ...over })

it('offers the live paid plans by name, marks Enterprise as sales only and keeps tiers the coupon already names', () => {
  render(<Picker plans={live()} tiers={['enterprise', 'retired']} savedTiers={['enterprise', 'retired']} />)
  const field = screen.getAllByRole('combobox')[0]
  expect(field).toHaveTextContent('Enterprise, retired')
  fireEvent.mouseDown(field)
  const listbox = screen.getByRole('listbox')
  expect(within(listbox).getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual(['Starter', 'Pro', 'Organization', 'Enterprise', 'Retired'])
  expect(within(listbox).getByRole('option', { name: 'Starter' })).toHaveAccessibleDescription('GH₵ 9.99/mo · GH₵ 99/yr at web checkout.')
  expect(within(listbox).getByRole('option', { name: 'Enterprise' })).toHaveAccessibleDescription('Sales only: reference price, not sold at web checkout.')
  expect(within(listbox).getByRole('option', { name: 'Retired' })).toHaveAccessibleDescription('Not a live plan; kept because this coupon already names it.')
  expect(within(listbox).queryByRole('option', { name: 'Free' })).toBeNull()
})

it('offers a retired plan only to a coupon that already names it, as not sold', () => {
  const byTier = buildPlanMap([...LIVE_PLANS, { ...livePlan('pro'), tier: 'legacy', name: 'Legacy', active: false }])
  render(<Picker plans={live({ byTier })} />)
  fireEvent.mouseDown(screen.getAllByRole('combobox')[0])
  expect(within(screen.getByRole('listbox')).queryByRole('option', { name: 'Legacy' })).toBeNull()
  cleanup()

  render(<Picker plans={live({ byTier })} tiers={['legacy']} savedTiers={['legacy']} />)
  fireEvent.mouseDown(screen.getAllByRole('combobox')[0])
  expect(within(screen.getByRole('listbox')).getByRole('option', { name: 'Legacy' })).toHaveAccessibleDescription('Retired: not sold at web checkout.')
})

it('shows a skeleton, not seed names, while plans load', () => {
  render(<Picker plans={live({ byTier: {}, isLoading: true })} />)
  expect(screen.queryByText('Applies to Tiers')).toBeNull()
  expect(screen.queryByText(/Plus|Community/)).toBeNull()
  expect(document.querySelector('.MuiSkeleton-root')).not.toBeNull()
})

it('shows an error with a retry when plans fail to load', () => {
  const retry = vi.fn()
  render(<Picker plans={live({ byTier: {}, error: 'The server could not complete this request.', retry })} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Plans could not be loaded, so tiers cannot be chosen right now. Retry to choose them. The server could not complete this request.')
  expect(screen.queryByText('Applies to Tiers')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledTimes(1)
})

it('tells an editor that saving keeps the coupon’s plans when plans fail to load', () => {
  render(<Picker editing plans={live({ byTier: {}, error: 'The server could not complete this request.' })} tiers={['starter']} />)
  expect(screen.getByRole('alert')).toHaveTextContent("Saving keeps this coupon's current plans.")
})
