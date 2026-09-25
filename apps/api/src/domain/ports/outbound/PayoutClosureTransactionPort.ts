import type { PayoutRequester } from '../../../application/use-cases/CreatePayoutRecipientUseCase.js'

/**
 * Commits a PENDING payout's rejection (admin) or cancellation (owner), the
 * return of what its request cleared, and the audit entry together — after
 * fencing the actor's current role/credentials at the write boundary.
 */
export interface PayoutClosureTransactionPort {
  run<T>(
    actor: PayoutRequester,
    closure: { kind: 'rejected' | 'cancelled'; payoutId: string; reason: string; rail?: 'campaign' | 'affiliate' | 'beneficiary' },
    work: () => Promise<T>,
  ): Promise<T>
}
