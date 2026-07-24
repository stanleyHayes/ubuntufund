// Leaderboard is a read-model aggregated from Donation + User records —
// no dedicated entity/collection of its own, so these are plain record
// types local to this slice (not present in @ubuntu-fund/types).

export type LeaderboardPeriod = 'daily' | 'monthly' | 'yearly' | 'lifetime';
export type LeaderboardCategory = 'all' | 'user' | 'organization';
export type LeaderboardDonorRole = 'user' | 'organization';

export interface LeaderboardQueryParams {
  period: LeaderboardPeriod;
  category: LeaderboardCategory;
  limit: number;
}

export interface LeaderboardDonorRecord {
  userId: string;
  userRole: LeaderboardDonorRole;
  name: string;
  avatarUrl?: string;
  totalDonated: number;
  donationCount: number;
  currency: string;
  campaignsSupported: number;
  isAnonymous: boolean;
}

export interface LeaderboardStatsRecord {
  totalAmount: number;
  totalDonations: number;
  totalDonors: number;
}

export interface LeaderboardRepositoryPort {
  getTopDonors(
    params: LeaderboardQueryParams
  ): Promise<LeaderboardDonorRecord[]>;
  getStats(
    params: Omit<LeaderboardQueryParams, 'limit'>
  ): Promise<LeaderboardStatsRecord>;
}
