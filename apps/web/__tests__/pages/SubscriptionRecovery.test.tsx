import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SubscriptionCallbackPage } from '@/pages/SubscriptionCallbackPage'
import { CreatorDashboardPage } from '@/pages/CreatorDashboardPage'
import { api } from '@/lib/api'
vi.mock('@/lib/api',()=>({api:{get:vi.fn(),post:vi.fn()}}))
afterEach(()=>vi.resetAllMocks())
describe('subscription return UI',()=>{
 it('recovers the exact provider reference without browser handoff storage',async()=>{
  vi.mocked(api.post).mockResolvedValue({id:'checkout',status:'succeeded',tier:'plus',finalAmount:29.99,currency:'GHS'})
  render(<MemoryRouter initialEntries={['/subscription/callback?reference=sub-dee42508']}><SubscriptionCallbackPage/></MemoryRouter>)
  expect(await screen.findByText("You're all set!")).toBeInTheDocument()
  expect(api.post).toHaveBeenCalledWith('/subscriptions/checkout/reference/sub-dee42508/verify')
 });
 it('keeps the View plans action on one line',async()=>{
  vi.mocked(api.get).mockImplementation(async path => path === '/payout-accounts' ? { accounts: [] } : path.endsWith('/payouts') ? [] : {profile:null,balance:null,policy:{eligible:false,planName:'Free',feePercent:0}})
  render(<MemoryRouter><CreatorDashboardPage/></MemoryRouter>)
  const link=await screen.findByRole('link',{name:'View plans'})
  expect(link).toHaveStyle({whiteSpace:'nowrap',flexShrink:'0'})
 });
 it('keeps the annual plan on payment retry without claiming no debit',async()=>{
  vi.mocked(api.post).mockResolvedValue({id:'checkout',status:'failed',tier:'enterprise',billingCycle:'yearly',finalAmount:999,currency:'GHS'})
  render(<MemoryRouter initialEntries={['/subscription/callback?checkout=checkout']}><SubscriptionCallbackPage/></MemoryRouter>)
  const retry = await screen.findByRole('link',{name:'Try again'})
  expect(retry).toHaveAttribute('href','/subscription?tier=enterprise&billingCycle=yearly')
  expect(screen.queryByText(/you haven't been charged/)).not.toBeInTheDocument()
 });

})
