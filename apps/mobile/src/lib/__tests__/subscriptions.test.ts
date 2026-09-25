import { beforeEach, describe, expect, it, vi } from 'vitest'
const { data, post } = vi.hoisted(() => ({ data: new Map<string,string>(), post: vi.fn() }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async(k:string)=>data.get(k)??null, setItem:async(k:string,v:string)=>{data.set(k,v)},removeItem:async(k:string)=>{data.delete(k)} } }))
vi.mock('../api',()=>({api:{post},ApiError:class extends Error{constructor(public status:number,message:string,public errors?:Record<string,string[]>){super(message)}}}))
vi.mock('../session',()=>({sessionSnapshot:()=>({user:{id:'owner'}})}))
import { abandonSubscriptionCheckout, checkoutInProgressId, createSubscriptionCheckout, getSubscriptionCheckoutStatus, recoverPendingSubscription } from '../subscriptions'
import { ApiError } from '../api'
beforeEach(()=>{data.clear();post.mockReset()})
describe('native subscription recovery',()=>{
 it('persists checkout before opening the external browser',async()=>{post.mockResolvedValue({checkout:{id:'checkout'},authorizationUrl:'https://checkout.paystack.com/test'});await createSubscriptionCheckout({} as never);expect(data.get('ujimora:subscription:owner')).toBe('checkout')})
 it('verifies the saved checkout on return and clears confirmed state',async()=>{data.set('ujimora:subscription:owner','checkout');post.mockResolvedValue({status:'succeeded'});await recoverPendingSubscription();expect(post).toHaveBeenCalledWith('/subscriptions/checkout/checkout/verify');expect(data.size).toBe(0)})
 it('retains pending checkouts for a later retry',async()=>{data.set('ujimora:subscription:owner','checkout');post.mockResolvedValue({status:'pending'});await getSubscriptionCheckoutStatus('checkout');expect(data.size).toBe(1)})
})
describe('an earlier unpaid checkout blocking a new purchase',()=>{
 it('names the open checkout only for the in-progress conflict',()=>{
  const blocked=new ApiError(409,'You already have a plan payment in progress.',{checkoutId:['earlier'],code:['checkout_in_progress']})
  expect(checkoutInProgressId(blocked)).toBe('earlier')
  expect(checkoutInProgressId(new ApiError(409,'Confirm the switch',{code:['replace_current_plan']}))).toBeNull()
  expect(checkoutInProgressId(new Error('other'))).toBeNull()
 })
 it('cancels the earlier checkout and forgets it for recovery',async()=>{data.set('ujimora:subscription:owner','earlier');post.mockResolvedValue({id:'earlier',status:'expired'});expect((await abandonSubscriptionCheckout('earlier')).status).toBe('expired');expect(post).toHaveBeenCalledWith('/subscriptions/checkout/earlier/abandon');expect(data.size).toBe(0)})
})
