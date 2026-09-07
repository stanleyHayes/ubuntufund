import type { Payout } from '@ubuntu-fund/types';
import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js';
import { toPayoutDto } from './mappers/payoutDto.js';

/** List every payout across the platform, newest first (admin console). */
export class ListPayoutsUseCase {
  constructor(private readonly payoutRepo: PayoutRepositoryPort) {}

  async execute(): Promise<Payout[]> {
    const payouts = await this.payoutRepo.findAll();
    return payouts.map(toPayoutDto);
  }

  /**
   * The admin review queue: payouts needing action — NEEDS_REVIEW (a batched
   * payout that settled only partially) and PENDING (awaiting approval, incl.
   * a maker-checker payout that has a first approval but not the second).
   */
  async reviewQueue(): Promise<Payout[]> {
    const payouts = await this.payoutRepo.findByStatuses(['NEEDS_REVIEW', 'PENDING']);
    return payouts.map(toPayoutDto);
  }
}
