import { describe, expect, it, vi } from 'vitest';
import { PayoutEntity } from '../../../src/domain/entities/Payout.js';
import { ApprovePayoutUseCase } from '../../../src/application/use-cases/ApprovePayoutUseCase.js';
import { ApproveAffiliatePayoutUseCase } from '../../../src/application/use-cases/ApproveAffiliatePayoutUseCase.js';
import { BeneficiaryPayoutUseCase } from '../../../src/application/use-cases/BeneficiaryPayoutUseCase.js';

const payout = (changes: Partial<ReturnType<PayoutEntity['toPlain']>> = {}) => new PayoutEntity({
  id: 'payout', status: 'PENDING', amount: 100, netAmount: 100, fee: 0, type: 'standard', currency: 'GHS',
  campaignId: 'campaign', recipientId: 'recipient', provider: 'paystack', requestedBy: 'owner',
  createdAt: new Date(), updatedAt: new Date(), ...changes,
});

function approvalFixture(p: PayoutEntity, creatorId = 'owner') {
  const recipients = { recordReview: vi.fn(async () => {}), findById: vi.fn(async () => ({ recipientCode: 'RCP_test', type: 'ghipss' })) };
  const manualApproval = { run: vi.fn(async (_requester: unknown, work: () => Promise<unknown>) => work()) };
  const repo = {
    findById: vi.fn(async () => p),
    lockPendingForReview: vi.fn(async () => p),
    transitionToProcessing: vi.fn(async () => new PayoutEntity({ ...p.toPlain(), status: 'PROCESSING' })),
    attachTransferCode: vi.fn(async () => null),
    setProviderStatus: vi.fn(async () => {}),
  };
  const gateway = {
    isConfigured: () => true,
    getBalance: vi.fn(async () => [{ currency: 'GHS', balance: 1000 }]),
    initiateTransfer: vi.fn(async () => ({ status: 'pending', transferCode: 'TRF_test' })),
  };
  const useCase = new ApprovePayoutUseCase(
    repo as never, recipients as never, { reserveForPayout: vi.fn(async () => ({})) } as never, gateway as never,
    { dualApprovalAmount: 0, maxTransferAmount: 50000 } as never,
    { findById: vi.fn(async () => ({ id: 'campaign', creatorId, endDate: new Date(0), raisedAmount: { amount: 100 }, goalAmount: { amount: 100 } })) } as never,
    undefined, undefined, manualApproval as never,
  );
  return { useCase, recipients, manualApproval, gateway };
}

const note = 'Verified the owner and receiving capacity for this payout.';

describe('payout segregation of duties', () => {
  it('refuses an admin approving a payout from their own campaign before any review is recorded', async () => {
    const { useCase, recipients, manualApproval, gateway } = approvalFixture(payout({ requestedBy: 'owner' }), 'admin-owner');
    await expect(useCase.execute('payout', { userId: 'admin-owner', role: 'admin' }, note)).rejects.toMatchObject({ statusCode: 403 });
    expect(recipients.recordReview).not.toHaveBeenCalled();
    expect(manualApproval.run).not.toHaveBeenCalled();
    expect(gateway.initiateTransfer).not.toHaveBeenCalled();
  });

  it('refuses an admin approving a payout they requested on the owner\'s behalf', async () => {
    const { useCase, recipients, gateway } = approvalFixture(payout({ requestedBy: 'admin-requester' }));
    await expect(useCase.execute('payout', { userId: 'admin-requester', role: 'admin' }, note)).rejects.toMatchObject({ statusCode: 403 });
    expect(recipients.recordReview).not.toHaveBeenCalled();
    expect(gateway.initiateTransfer).not.toHaveBeenCalled();
  });

  it('lets a different administrator approve', async () => {
    const { useCase, recipients, gateway } = approvalFixture(payout());
    const approved = await useCase.execute('payout', { userId: 'other-admin', role: 'admin' }, note);
    expect(approved.status).toBe('PROCESSING');
    expect(recipients.recordReview).toHaveBeenCalledOnce();
    expect(gateway.initiateTransfer).toHaveBeenCalledOnce();
  });

  it('refuses an admin approving their own affiliate commission payout', async () => {
    const gateway = { isConfigured: () => true, getBalance: vi.fn(async () => [{ currency: 'GHS', balance: 1000 }]), initiateTransfer: vi.fn() };
    const approval = { run: vi.fn() };
    const useCase = new ApproveAffiliatePayoutUseCase(
      { findById: async () => ({ id: 'aff-payout', affiliateId: 'affiliate', amount: 50, currency: 'GHS', status: 'PENDING', requestedBy: 'affiliate-user' }) } as never,
      { findById: async () => ({ id: 'affiliate', userId: 'affiliate-user', recipientCode: 'RCP_aff', status: 'active' }) } as never,
      {} as never, gateway as never, approval as never,
    );
    await expect(useCase.execute('aff-payout', { userId: 'affiliate-user', role: 'admin' })).rejects.toMatchObject({ statusCode: 403 });
    expect(approval.run).not.toHaveBeenCalled();
    expect(gateway.initiateTransfer).not.toHaveBeenCalled();
  });

  it('refuses an admin who requested a beneficiary payout', async () => {
    const requestedBy = 'admin-a', creatorId = 'owner'
    const recipients = { findByCampaignAndBeneficiary: vi.fn() };
    const gateway = { isConfigured: () => true, getBalance: vi.fn(), initiateTransfer: vi.fn() };
    const useCase = new BeneficiaryPayoutUseCase(
      true,
      { findById: async () => ({ id: 'campaign', creatorId }) } as never,
      {} as never, {} as never, {} as never, recipients as never,
      { findById: async () => ({ id: 'bpay', campaignId: 'campaign', beneficiaryId: 'b1', status: 'PENDING', requestedBy, amount: 10, currency: 'GHS' }) } as never,
      gateway as never, { run: vi.fn() } as never,
    );
    await expect(useCase.approvePayout('bpay', { userId: 'admin-a', role: 'admin' }, note)).rejects.toMatchObject({ statusCode: 403 });
    expect(recipients.findByCampaignAndBeneficiary).not.toHaveBeenCalled();
    expect(gateway.initiateTransfer).not.toHaveBeenCalled();
  });
});
