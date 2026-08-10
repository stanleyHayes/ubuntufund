// Platform overview is a read-model aggregated across Users, Campaigns,
// Donations and Reports — no dedicated entity/collection of its own, so
// these are plain record types local to this slice (not present in
// @ubuntu-fund/types), matching the LeaderboardRepositoryPort precedent.
export interface PlatformOverviewRecord {
  totalUsers: number;
  activeCampaigns: number;
  /** Campaign counts keyed by CampaignStatus value, e.g. 'active', 'funded'. */
  campaignsByStatus: Record<string, number>;
  totalDonations: number;
  totalRaised: number;
  avgDonation: number;
  conversionRate: number;
  monthlyGrowth: number;
  pendingDisputes: number;
}

export interface AnalyticsReportRecord {
  donationTrend: Array<{ month: string; amount: number }>;
  categoryBreakdown: Array<{ category: string; value: number }>;
  geographicData: Array<{ country: string; campaigns: number; donations: number }>;
  fraudMetrics: Array<{ metric: string; value: number; change: number }>;
}

export interface AnalyticsRepositoryPort {
  getOverview(): Promise<PlatformOverviewRecord>;
  getReports(): Promise<AnalyticsReportRecord>;
}
