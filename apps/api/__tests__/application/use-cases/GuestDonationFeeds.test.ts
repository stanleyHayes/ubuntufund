import { describe, expect, it, vi } from 'vitest';
import { PaymentMethod } from '@ubuntu-fund/types';
import { DonationEntity, GUEST_DONOR_ID } from '../../../src/domain/entities/Donation.js';
import { Money } from '../../../src/domain/value-objects/Money.js';
import { ListCampaignDonationsUseCase } from '../../../src/application/use-cases/ListCampaignDonationsUseCase.js';
import { ListRecentDonationsUseCase } from '../../../src/application/use-cases/ListRecentDonationsUseCase.js';
import { GetLiveSessionOverlayUseCase } from '../../../src/application/use-cases/GetLiveSessionOverlayUseCase.js';
import { RealtimeDonationProjector } from '../../../src/application/services/RealtimeDonationProjector.js';

const registeredId = '6aa184c66d4e5ed850d9e641';
function fixture(isAnonymous = false, donorId = GUEST_DONOR_ID) {
  const donation = new DonationEntity({id:'donation',campaignId:'campaign',donorId,
    amount:new Money(200,'GHS'),paymentMethod:PaymentMethod.CARD,isAnonymous,createdAt:new Date()});
  const donorRepo = {findById:vi.fn(async (id: string) => {
    if (id === GUEST_DONOR_ID) throw new Error('Cast to ObjectId failed');
    return {name:'Registered supporter',avatarUrl:'avatar.png'};
  })};
  const campaignRepo = {findById:vi.fn(async () => ({id:'campaign',title:'Campaign',raisedAmount:new Money(200,'GHS'),goalAmount:new Money(1000,'GHS')}))};
  const donationRepo = {findByCampaignId:vi.fn(async () => [donation]),findRecent:vi.fn(async () => [donation])};
  return {donation,donorRepo,campaignRepo,donationRepo};
}

describe('Guest donations in public read models', () => {
  it.each([false,true])('loads the campaign donations tab for a guest (anonymous=%s)', async anonymous => {
    const f = fixture(anonymous);
    const useCase = new ListCampaignDonationsUseCase(f.donationRepo as never,f.campaignRepo as never,f.donorRepo as never);
    const result = await useCase.execute('campaign',{});
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({donorName:anonymous?'Anonymous':'Guest donor',amount:200,isAnonymous:anonymous});
    expect(result.items[0].donorAvatarUrl).toBeUndefined();
    expect(f.donorRepo.findById).not.toHaveBeenCalled();
  });

  it('still resolves registered donors in the same list', async () => {
    const f = fixture(false,registeredId);
    const result = await new ListCampaignDonationsUseCase(f.donationRepo as never,f.campaignRepo as never,f.donorRepo as never).execute('campaign',{});
    expect(result.items[0]).toMatchObject({donorName:'Registered supporter',donorAvatarUrl:'avatar.png'});
    expect(f.donorRepo.findById).toHaveBeenCalledWith(registeredId);
  });

  it.each([false,true])('loads recent donations for a guest (anonymous=%s)', async anonymous => {
    const f = fixture(anonymous);
    const result = await new ListRecentDonationsUseCase(f.donationRepo as never,f.campaignRepo as never,f.donorRepo as never).execute();
    expect(result[0].donorName).toBe(anonymous?undefined:'Guest donor');
    expect(f.donorRepo.findById).not.toHaveBeenCalled();
  });

  it.each([true,false])('loads guest live overlays while respecting name visibility (%s)', async visible => {
    const f = fixture();
    const sessionRepo = {findById:vi.fn(async () => ({id:'live',campaignId:'campaign',overlayToken:'token',stats:{},
      namesVisible:()=>visible,amountsVisible:()=>true,messagesVisible:()=>true}))};
    const result = await new GetLiveSessionOverlayUseCase(sessionRepo as never,f.campaignRepo as never,f.donationRepo as never,f.donorRepo as never).execute('live','token');
    expect(result.recentDonors[0].name).toBe(visible?'Guest donor':'Anonymous');
    expect(f.donorRepo.findById).not.toHaveBeenCalled();
  });

  it.each([false,true])('publishes guest realtime events without a user lookup (anonymous=%s)', async anonymous => {
    const f = fixture(anonymous);
    const bus = {publish:vi.fn()};
    const projector = new RealtimeDonationProjector(bus as never,f.campaignRepo as never,{} as never,f.donorRepo as never);
    await projector.recordDonationRealtime('campaign',undefined,{donationId:'donation',donorId:GUEST_DONOR_ID,
      amount:200,currency:'GHS',isAnonymous:anonymous,createdAt:new Date()});
    expect(bus.publish).toHaveBeenCalledWith(expect.any(String),'donation',expect.objectContaining({name:anonymous?'Anonymous':'Guest donor'}));
    expect(f.donorRepo.findById).not.toHaveBeenCalled();
  });
});
