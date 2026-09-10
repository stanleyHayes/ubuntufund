import { describe, expect, it, vi } from 'vitest';
import { GetCampaignPayoutOptionsUseCase } from '../../../src/application/use-cases/GetCampaignPayoutOptionsUseCase.js';
describe('cashout options', () => {
  const balances = { findByCampaignId: vi.fn(async () => ({ pendingBalance: 90, availableBalance: 10, currency: 'GHS' })) };
  const recipients = { findLatestByCampaignId: vi.fn(async () => ({ accountName: 'Owner', accountNumber: '0241234567', type: 'mobile_money' })) };
  const uc = new GetCampaignPayoutOptionsUseCase({ findById: async () => ({ creatorId: 'owner', endDate: new Date(0), raisedAmount: { amount: 100 }, goalAmount: { amount: 1000 } }) } as never, balances as never, recipients as never, { resolvePayoutsConfig: async () => ({ earlyMaxWithdrawalPercent: 80 }) } as never);
  it('rejects a different user before disclosing account/balance details', async () => {
    await expect(uc.execute('campaign', { userId: 'other' })).rejects.toMatchObject({ statusCode: 403 });
    expect(balances.findByCampaignId).not.toHaveBeenCalled();
  });
  it('returns net eligible proceeds and only the account suffix', async () => {
    expect(await uc.execute('campaign', { userId: 'owner' })).toEqual({ requiresEarlyCashout: false, eligible: 100, currency: 'GHS', fees: { earlyMaxWithdrawalPercent: 80 }, recipient: { accountName: 'Owner', last4: '4567', type: 'mobile_money' } });
  });
});
