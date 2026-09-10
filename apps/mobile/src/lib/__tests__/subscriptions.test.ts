import { beforeEach, describe, expect, it, vi } from 'vitest'
const { data, post } = vi.hoisted(() => ({ data: new Map<string,string>(), post: vi.fn() }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async(k:string)=>data.get(k)??null, setItem:async(k:string,v:string)=>{data.set(k,v)},removeItem:async(k:string)=>{data.delete(k)} } }))
vi.mock('../api',()=>({api:{post},ApiError:class extends Error{}}))
vi.mock('../session',()=>({sessionSnapshot:()=>({user:{id:'owner'}})}))
import { createSubscriptionCheckout, getSubscriptionCheckoutStatus, recoverPendingSubscription } from '../subscriptions'
beforeEach(()=>{data.clear();post.mockReset()})
describe('native subscription recovery',()=>{
 it('persists checkout before opening the external browser',async()=>{post.mockResolvedValue({checkout:{id:'checkout'},authorizationUrl:'https://checkout.paystack.com/test'});await createSubscriptionCheckout({} as never);expect(data.get('ujimora:subscription:owner')).toBe('checkout')})
 it('verifies the saved checkout on return and clears confirmed state',async()=>{data.set('ujimora:subscription:owner','checkout');post.mockResolvedValue({status:'succeeded'});await recoverPendingSubscription();expect(post).toHaveBeenCalledWith('/subscriptions/checkout/checkout/verify');expect(data.size).toBe(0)})
 it('retains pending checkouts for a later retry',async()=>{data.set('ujimora:subscription:owner','checkout');post.mockResolvedValue({status:'pending'});await getSubscriptionCheckoutStatus('checkout');expect(data.size).toBe(1)})
})
