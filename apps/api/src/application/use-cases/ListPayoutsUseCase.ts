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
}
