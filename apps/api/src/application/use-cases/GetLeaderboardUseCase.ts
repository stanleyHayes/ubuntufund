import type {
  LeaderboardRepositoryPort,
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../../domain/ports/outbound/LeaderboardRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

const VALID_PERIODS: LeaderboardPeriod[] = [
  'daily',
  'monthly',
  'yearly',
  'lifetime',
];
const VALID_CATEGORIES: LeaderboardCategory[] = ['all', 'user', 'organization'];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface LeaderboardQueryInput {
  period?: string;
  category?: string;
  limit?: string;
}

export interface LeaderboardEntryDTO {
  rank: number;
  userId: string;
  userRole: 'user' | 'organization';
  name: string;
  avatarUrl?: string;
  totalDonated: number;
  donationCount: number;
  currency: string;
  campaignsSupported: number;
  isAnonymous: boolean;
}

export function parseLeaderboardPeriod(value?: string): LeaderboardPeriod {
  const period = value ?? 'lifetime';
  if (!VALID_PERIODS.includes(period as LeaderboardPeriod)) {
    throw new AppError(
      `Invalid period: must be one of ${VALID_PERIODS.join(', ')}`,
      400
    );
  }
  return period as LeaderboardPeriod;
}

export function parseLeaderboardCategory(value?: string): LeaderboardCategory {
  const category = value ?? 'all';
  if (!VALID_CATEGORIES.includes(category as LeaderboardCategory)) {
    throw new AppError(
      `Invalid category: must be one of ${VALID_CATEGORIES.join(', ')}`,
      400
    );
  }
  return category as LeaderboardCategory;
}

function parseLimit(value?: string): number {
  if (value === undefined) return DEFAULT_LIMIT;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError('Invalid limit: must be a positive number', 400);
  }
  return Math.min(parsed, MAX_LIMIT);
}

export class GetLeaderboardUseCase {
  constructor(private readonly leaderboardRepo: LeaderboardRepositoryPort) {}

  async execute(query: LeaderboardQueryInput): Promise<LeaderboardEntryDTO[]> {
    const period = parseLeaderboardPeriod(query.period);
    const category = parseLeaderboardCategory(query.category);
    const limit = parseLimit(query.limit);

    const donors = await this.leaderboardRepo.getTopDonors({
      period,
      category,
      limit,
    });

    return donors.map((donor, index) => ({
      rank: index + 1,
      ...donor,
    }));
  }
}
