import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SubscriptionCallbackPage } from '@/pages/SubscriptionCallbackPage'
import { CreatorDashboardPage } from '@/pages/CreatorDashboardPage'
import { api } from '@/lib/api'
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'creator-fixture' } }) }))
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
 it('forgets the browser handoff once the checkout is settled',async()=>{
  const pending={checkoutId:'checkout',reference:'sub-1',tier:'pro',billingCycle:'monthly',finalAmount:149,currency:'GHS'}
  const data=new Map<string,string>()
  vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}})
  localStorage.setItem('uf_pending_subscriptions',JSON.stringify({'sub-1':pending,__last:pending}))
  vi.mocked(api.post).mockResolvedValue({id:'checkout',status:'succeeded',tier:'pro',finalAmount:149,currency:'GHS'})
  render(<MemoryRouter initialEntries={['/subscription/callback?checkout=checkout']}><SubscriptionCallbackPage/></MemoryRouter>)
  expect(await screen.findByText("You're all set!")).toBeInTheDocument()
  expect(localStorage.getItem('uf_pending_subscriptions')).toBeNull()
  vi.unstubAllGlobals()
 });
 it('stops polling on a rate limit instead of burning the budget',async()=>{
  vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Too many requests, please try again later'),{status:429}))
  render(<MemoryRouter initialEntries={['/subscription/callback?checkout=checkout']}><SubscriptionCallbackPage/></MemoryRouter>)
  expect(await screen.findByText('Still confirming your subscription')).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Keep checking'})).toBeDisabled()
  expect(screen.getByText(/wait a minute before checking again/)).toBeInTheDocument()
  expect(api.post).toHaveBeenCalledTimes(1)
 });
 it('reads the stored status between provider checks and backs off',async()=>{
  vi.useFakeTimers()
  try {
   vi.mocked(api.post).mockResolvedValue({id:'checkout',status:'pending',tier:'pro',finalAmount:149,currency:'GHS'})
   vi.mocked(api.get).mockResolvedValue({id:'checkout',status:'pending',tier:'pro',finalAmount:149,currency:'GHS'})
   render(<MemoryRouter initialEntries={['/subscription/callback?checkout=checkout']}><SubscriptionCallbackPage/></MemoryRouter>)
   await act(async()=>{await vi.advanceTimersByTimeAsync(0)})
   expect(api.post).toHaveBeenCalledTimes(1)
   await act(async()=>{await vi.advanceTimersByTimeAsync(2000)})
   expect(api.get).toHaveBeenCalledWith('/subscriptions/checkout/checkout')
   await act(async()=>{await vi.advanceTimersByTimeAsync(2999)})
   expect(api.get).toHaveBeenCalledTimes(1) // second gap is 3s, not 2s
   await act(async()=>{await vi.advanceTimersByTimeAsync(1)})
   expect(api.get).toHaveBeenCalledTimes(2)
   await act(async()=>{await vi.advanceTimersByTimeAsync(5000)})
   expect(api.post).toHaveBeenCalledTimes(2) // 4th check asks Paystack again
  } finally { vi.useRealTimers() }
 });
 it('keeps the annual plan on payment retry without claiming no debit',async()=>{
  vi.mocked(api.post).mockResolvedValue({id:'checkout',status:'failed',tier:'enterprise',billingCycle:'yearly',finalAmount:999,currency:'GHS'})
  render(<MemoryRouter initialEntries={['/subscription/callback?checkout=checkout']}><SubscriptionCallbackPage/></MemoryRouter>)
  const retry = await screen.findByRole('link',{name:'Try again'})
  expect(retry).toHaveAttribute('href','/subscription?tier=enterprise&billingCycle=yearly')
  expect(screen.queryByText(/you haven't been charged/)).not.toBeInTheDocument()
 });

})
