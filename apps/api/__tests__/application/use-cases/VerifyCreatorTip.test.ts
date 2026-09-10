import { describe, it, expect, vi } from 'vitest';
import { VerifyCreatorTipUseCase } from '../../../src/application/use-cases/VerifyCreatorTipUseCase.js';
function setup(status='PENDING', verified={reference:'tip-fixture123',amount:25,currency:'GHS',status:'success'}) {
 let tip={status,amount:25,currency:'GHS',providerRef:'tip-fixture123',creatorUserId:'creator',toPlain:()=>({settlementApplied:true})};
 const repo={findByProviderRef:vi.fn(async()=>tip)};
 const gateway={verifyTransaction:vi.fn(async()=>verified)};
 const settlement={handleSuccess:vi.fn(async()=>{tip={...tip,status:'SUCCEEDED'}}),handleFailed:vi.fn(async()=>{tip={...tip,status:'FAILED'}}),creditSucceededTip:vi.fn()};
 const uc=new VerifyCreatorTipUseCase(repo as never,{findByUserId:async()=>({displayName:'Stanley',handle:'pontifex'})} as never,gateway as never,settlement as never);
 return {uc,repo,gateway,settlement};
}
describe('guest creator payment confirmation',()=>{
 it('recovers provider success through existing settlement without exposing private data',async()=>{const {uc,settlement}=setup();expect(await uc.execute('tip-fixture123')).toEqual({status:'SUCCEEDED',amount:25,currency:'GHS',handle:'pontifex',displayName:'Stanley',thankYouMessage:undefined});expect(settlement.handleSuccess).toHaveBeenCalledWith('tip-fixture123')});
 it.each([{reference:'tip-other123',amount:25,currency:'GHS',status:'success'},{reference:'tip-fixture123',amount:26,currency:'GHS',status:'success'},{reference:'tip-fixture123',amount:25,currency:'USD',status:'success'}])('rejects mismatched provider data',async data=>{const {uc,settlement}=setup('PENDING',data);await expect(uc.execute('tip-fixture123')).rejects.toMatchObject({statusCode:409});expect(settlement.handleSuccess).not.toHaveBeenCalled()});
 it('does not re-credit a confirmed settled tip',async()=>{const {uc,gateway,settlement}=setup('SUCCEEDED');await uc.execute('tip-fixture123');expect(gateway.verifyTransaction).not.toHaveBeenCalled();expect(settlement.handleSuccess).not.toHaveBeenCalled();expect(settlement.creditSucceededTip).not.toHaveBeenCalled()});
 it('leaves processing payments pending',async()=>{const {uc,settlement}=setup('PENDING',{reference:'tip-fixture123',amount:25,currency:'GHS',status:'pending'});expect((await uc.execute('tip-fixture123')).status).toBe('PENDING');expect(settlement.handleSuccess).not.toHaveBeenCalled()});
 it('does not verify an unknown reference',async()=>{const {uc,repo,gateway}=setup();repo.findByProviderRef.mockResolvedValueOnce(null as never);await expect(uc.execute('tip-unknown')).rejects.toMatchObject({statusCode:404});expect(gateway.verifyTransaction).not.toHaveBeenCalled()});
});

import { CreateTipIntentUseCase } from '../../../src/application/use-cases/CreateTipIntentUseCase.js';
it('persists a strong payment reference before opening provider checkout',async()=>{
 let savedReference='';const tips={create:vi.fn(async tip=>{savedReference=tip.providerRef;return {id:'tip-id'}})};
 const gateway={initializeCharge:vi.fn(async params=>{expect(savedReference).toMatch(/^tip-[a-f0-9-]{36}$/);expect(params.reference).toBe(savedReference);return {reference:params.reference,authorizationUrl:'https://checkout.paystack.com/test',accessCode:'test'}})};
 const uc=new CreateTipIntentUseCase({findByHandle:async()=>({userId:'creator',handle:'pontifex',tipsEnabled:true,currency:'GHS'})} as never,tips as never,{ensure:vi.fn()} as never,gateway as never,{assertCreatorDonations:vi.fn()} as never);
 const result=await uc.execute('pontifex',{amount:25,supporterEmail:'donor@example.com'});expect(result.reference).toBe(savedReference);expect(gateway.initializeCharge).toHaveBeenCalledWith(expect.objectContaining({callbackPath:'/tip/callback'}));
});
