import { expect, it, vi } from 'vitest'
import { ApprovePayoutUseCase } from '../../../src/application/use-cases/ApprovePayoutUseCase.js'
it('rechecks after the balance lookup and refuses to reserve or send after revocation', async () => {
  let revoked = false
  const payout = { id: 'payout', requestedBy: 'owner', provider: 'paystack', status: 'PENDING', amount: 100, netAmount: 100, currency: 'GHS', type: 'standard', campaignId: 'campaign', recipientId: 'recipient' }
  const repo = { findById: async () => payout, transitionToProcessing: vi.fn() }
  const balances = { reserveForPayout: vi.fn() }
  const provider = { isConfigured: () => true, getBalance: async () => { revoked = true; return [{ currency: 'GHS', balance: 1000 }] }, initiateTransfer: vi.fn() }
  const guard = { run: vi.fn(async () => { if (revoked) throw new Error('Verification changed') }) }
  const uc = new ApprovePayoutUseCase(repo as never, { findById: async () => ({ recipientCode: 'RCP_fixture' }) } as never, balances as never, provider as never, { dualApprovalAmount: 0, maxTransferAmount: 50000 } as never, undefined, undefined, guard)
  await expect(uc.executeAutomatic('payout')).rejects.toThrow('Verification changed')
  expect(guard.run).toHaveBeenCalledWith('owner', expect.any(Function))
  expect(balances.reserveForPayout).not.toHaveBeenCalled()
  expect(repo.transitionToProcessing).not.toHaveBeenCalled()
  expect(provider.initiateTransfer).not.toHaveBeenCalled()
})
