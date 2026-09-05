import type { KYCRepositoryPort } from '../../domain/ports/outbound/KYCRepositoryPort.js';

export class GetKYCStatsUseCase {
  constructor(private readonly kycRepo: Pick<KYCRepositoryPort, 'getStats'>) {}

  execute(now = new Date()) {
    // Ghana uses UTC year-round. Count review decisions, not submission dates.
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return this.kycRepo.getStats(start, end);
  }
}
