import { describe, expect, it, vi } from 'vitest';
import { GetSubscriptionCheckoutUseCase } from '../../../src/application/use-cases/GetSubscriptionCheckoutUseCase.js';
function fixture() {
  const checkout = { id:'checkout', userId:'owner', status:'pending', finalAmount:100, currency:'GHS', providerRef:'sub-reference' };
  const repo = { transitionToFailed:vi.fn(async () => { checkout.status='failed'; return checkout }), findById:vi.fn(async () => checkout),findByProviderRef:vi.fn(async () => checkout) };
  const gateway = { verifyTransaction:vi.fn(async () => ({ status:'success',reference:'sub-reference',amount:100,currency:'GHS' })) };
  const settle = { execute:vi.fn(async () => { checkout.status='succeeded' }) };
  return { checkout, repo, gateway, settle, uc:new GetSubscriptionCheckoutUseCase(repo as never,gateway as never,settle as never) };
}
describe('subscription return verification', () => {
  it('resolves an old return reference for its owner',async()=>{const f=fixture();expect((await f.uc.verifyReference('sub-reference','owner')).status).toBe('succeeded')});
  it('does not resolve another owner’s checkout by reference',async()=>{const f=fixture();await expect(f.uc.verifyReference('sub-reference','other')).rejects.toMatchObject({statusCode:404});expect(f.gateway.verifyTransaction).not.toHaveBeenCalled()});
  it('recovers a paid checkout after a missed webhook and does not settle twice',async()=>{const f=fixture();expect((await f.uc.verify('checkout','owner')).status).toBe('succeeded');await f.uc.verify('checkout','owner');expect(f.settle.execute).toHaveBeenCalledTimes(1)});
  it('rejects another user before contacting Paystack',async()=>{const f=fixture();await expect(f.uc.verify('checkout','other')).rejects.toMatchObject({statusCode:404});expect(f.gateway.verifyTransaction).not.toHaveBeenCalled()});
  it.each([{amount:99},{currency:'NGN'},{reference:'different'}])('rejects mismatched provider evidence %j',async mismatch=>{const f=fixture();f.gateway.verifyTransaction.mockResolvedValue({status:'success',reference:'sub-reference',amount:100,currency:'GHS',...mismatch});await expect(f.uc.verify('checkout','owner')).rejects.toMatchObject({statusCode:409});expect(f.settle.execute).not.toHaveBeenCalled()});
  it('does not activate a pending provider payment',async()=>{const f=fixture();f.gateway.verifyTransaction.mockResolvedValue({status:'pending',reference:'sub-reference',amount:100,currency:'GHS'});expect((await f.uc.verify('checkout','owner')).status).toBe('pending');expect(f.settle.execute).not.toHaveBeenCalled()});
  it('marks a verified failed payment without activating the plan',async()=>{const f=fixture();f.gateway.verifyTransaction.mockResolvedValue({status:'failed',reference:'sub-reference',amount:100,currency:'GHS'});expect((await f.uc.verify('checkout','owner')).status).toBe('failed');expect(f.settle.execute).not.toHaveBeenCalled()});
  it('does not activate an abandoned checkout',async()=>{const f=fixture();f.gateway.verifyTransaction.mockResolvedValue({status:'abandoned',reference:'sub-reference',amount:100,currency:'GHS'});expect((await f.uc.verify('checkout','owner')).status).toBe('pending');expect(f.settle.execute).not.toHaveBeenCalled()});

});
