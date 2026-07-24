import type { LeaderboardRepositoryPort } from '../../domain/ports/outbound/LeaderboardRepositoryPort.js';
import {
  parseLeaderboardPeriod,
  parseLeaderboardCategory,
  type LeaderboardQueryInput,
} from './GetLeaderboardUseCase.js';

export interface LeaderboardStatsDTO {
  totalAmount: number;
  totalDonations: number;
  totalDonors: number;
}

export class GetLeaderboardStatsUseCase {
  constructor(private readonly leaderboardRepo: LeaderboardRepositoryPort) {}

  async execute(
    query: Omit<LeaderboardQueryInput, 'limit'>
  ): Promise<LeaderboardStatsDTO> {
    const period = parseLeaderboardPeriod(query.period);
    const category = parseLeaderboardCategory(query.category);

    return this.leaderboardRepo.getStats({ period, category });
  }
}
