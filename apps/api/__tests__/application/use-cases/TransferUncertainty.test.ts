import { PayoutEntity } from '../../../src/domain/entities/Payout.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransferOutcomeUnknownError } from '../../../src/domain/errors/TransferOutcomeUnknownError.js';
import { PaystackGateway } from '../../../src/infrastructure/adapters/outbound/payments/PaystackGateway.js';
import { ApprovePayoutUseCase } from '../../../src/application/use-cases/ApprovePayoutUseCase.js';
const gateway = new PaystackGateway({ secretKey: 'sk_test_fixture', publicKey: '', publicWebUrl: 'http://localhost' });
const transfer = { amount: 100, recipientCode: 'RCP_test', reference: 'pout-test-reference' };
afterEach(() => vi.unstubAllGlobals());
describe('ambiguous transfer outcomes', () => {
  it('distinguishes a timeout from a rejected transfer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    await expect(gateway.initiateTransfer(transfer)).rejects.toBeInstanceOf(TransferOutcomeUnknownError);
  });
  it('treats a provider server error as unconfirmed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: false }), { status: 500 })));
    await expect(gateway.initiateTransfer(transfer)).rejects.toBeInstanceOf(TransferOutcomeUnknownError);
  });
  it('keeps funds reserved and the original reference after a timeout', async () => {
    const p = new PayoutEntity({ id: 'payout', status: 'PENDING', amount: 100, netAmount: 100, fee: 0, type: 'standard', currency: 'GHS', campaignId: 'campaign', recipientId: 'recipient', provider: 'paystack', requestedBy: 'owner', createdAt: new Date(), updatedAt: new Date() });
    const repo = { findById: vi.fn(async () => p), lockPendingForReview: vi.fn(async () => p), transitionToProcessing: vi.fn(async (_id: string, fields: { approvedBy: string; providerRef: string }) => new PayoutEntity({ ...p.toPlain(), ...fields, status: 'PROCESSING' })), transitionToFailed: vi.fn() };
    const balances = { reserveForPayout: vi.fn(async () => ({})), returnToAvailable: vi.fn() };
    const provider = { isConfigured: () => true, getBalance: async () => [{ currency: 'GHS', balance: 1000 }], initiateTransfer: vi.fn().mockRejectedValue(new TransferOutcomeUnknownError()) };
    const uc = new ApprovePayoutUseCase(repo as never, { recordReview: vi.fn(async () => {}), findById: async () => ({ recipientCode: 'RCP_test' }) } as never, balances as never, provider as never, { dualApprovalAmount: 0, maxTransferAmount: 50000 } as never, undefined, undefined, undefined, { run: async (_requester, work) => work() });
    await expect(uc.execute('payout', { userId: 'admin', role: 'admin' }, 'Owner identity and receiving capacity reviewed')).rejects.toThrow('confirmation is pending');
    const persistedReference = repo.transitionToProcessing.mock.calls[0]?.[1].providerRef;
    expect(persistedReference).toBeTruthy();
    expect(provider.initiateTransfer).toHaveBeenCalledWith(expect.objectContaining({ reference: persistedReference, amount: 100, currency: 'GHS' }));
    expect(balances.reserveForPayout).toHaveBeenCalledTimes(1);
    expect(repo.transitionToProcessing).toHaveBeenCalled(); expect(repo.transitionToFailed).not.toHaveBeenCalled(); expect(balances.returnToAvailable).not.toHaveBeenCalled();
  });
});
