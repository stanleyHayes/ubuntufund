import { describe, expect, it, vi } from 'vitest';
import { campaignNeedsEarlyCashout, computePayoutFee } from '../../../src/application/services/payoutFee.js';
import { RequestPayoutUseCase } from '../../../src/application/use-cases/RequestPayoutUseCase.js';
import { ApprovePayoutUseCase } from '../../../src/application/use-cases/ApprovePayoutUseCase.js';
const campaign = {creatorId:'owner',endDate:new Date(Date.now()+86400000),raisedAmount:{amount:500},goalAmount:{amount:1000}};
const cfg={earlyFeePercent:3,earlyMinFee:20,urgentFeePercent:1.5,urgentMinFee:30,earlyMaxWithdrawalPercent:80};
describe('early cashout surcharge',()=>{
 it('identifies early, ended and goal-reached campaigns',()=>{expect(campaignNeedsEarlyCashout(campaign)).toBe(true);expect(campaignNeedsEarlyCashout({...campaign,endDate:new Date(0)})).toBe(false);expect(campaignNeedsEarlyCashout({...campaign,raisedAmount:{amount:1000}})).toBe(false)});
 it('does not let urgent pricing undercut the configured early surcharge',()=>{expect(computePayoutFee('urgent',2000,cfg as never)).toEqual({fee:60,netAmount:1940})});
 it.each(['standard','priority','assisted'])('rejects %s before creating an early payout',async type=>{
  const payouts={create:vi.fn()};const balances={findByCampaignId:async()=>({availableBalance:500,pendingBalance:0}),clearPendingToAvailable:vi.fn()};
  const uc=new RequestPayoutUseCase({findById:async()=>campaign} as never,{findLatestByCampaignId:async()=>({id:'recipient'})} as never,payouts as never,balances as never,{isConfigured:()=>true} as never,cfg as never);
  await expect(uc.execute('campaign',{amount:100,type} as never,{userId:'owner'})).rejects.toMatchObject({statusCode:422});expect(payouts.create).not.toHaveBeenCalled();
 });
 it('blocks approval of an existing standard request for an active underfunded campaign',async()=>{
  const gateway={isConfigured:()=>true,initiateTransfer:vi.fn()};const uc=new ApprovePayoutUseCase({findById:async()=>({status:'PENDING',campaignId:'campaign',type:'standard'})} as never,{} as never,{} as never,gateway as never,cfg as never,{findById:async()=>campaign} as never);
  await expect(uc.execute('payout',{userId:'admin',role:'admin'})).rejects.toMatchObject({statusCode:422});expect(gateway.initiateTransfer).not.toHaveBeenCalled();
 });
});
