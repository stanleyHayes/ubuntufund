import type { Campaign, User } from '@ubuntu-fund/types'
import type { AnalyticsReports } from '@/hooks/useApiData'
import { dateCell, type ExportTable } from './report'
import type { AdminDonation } from '@/hooks/useApiData'
import type { PlatformStats } from '@/types/api'
import { exportTable } from './report'

export function donationsTable(rows: AdminDonation[]): ExportTable {
  return exportTable('Donations', rows, { ID: r => r.id, Campaign: r => r.campaignTitle ?? r.campaignId, Supporter: r => r.isAnonymous ? 'Anonymous' : r.donorName ?? r.donorId, Amount: r => r.amount, Currency: r => r.currency, Method: r => r.paymentMethod, Anonymous: r => r.isAnonymous, 'Date (UTC)': r => dateCell(r.createdAt) })
}
export function overviewTable(stats: PlatformStats): ExportTable {
  return exportTable('Platform overview', [stats], { 'Total raised (GHS)': r => r.totalRaised, 'Active campaigns': r => r.activeCampaigns, Users: r => r.totalUsers, 'Pending disputes': r => r.pendingDisputes, Donations: r => r.totalDonations, 'Average donation (GHS)': r => r.avgDonation, 'Conversion (%)': r => r.conversionRate, 'Monthly growth (%)': r => r.monthlyGrowth })
}

export function usersTable(users: User[]): ExportTable {
  return { title: 'Users', columns: [{ label: 'ID' }, { label: 'Name' }, { label: 'Email' }, { label: 'Role' }, { label: 'Verification level', type: 'number' }, { label: 'Trust score', type: 'number' }, { label: 'Needs website' }, { label: 'Joined (UTC)', type: 'date' }],
    rows: users.map(user => [user.id, user.name, user.email, user.role, user.verificationLevel, user.trustScore, user.needsWebsite ?? false, dateCell(user.createdAt)]) }
}
export function campaignsTable(campaigns: Campaign[]): ExportTable {
  return { title: 'Campaigns', columns: [{ label: 'ID' }, { label: 'Title' }, { label: 'Status' }, { label: 'Category' }, { label: 'Currency' }, { label: 'Goal', type: 'number' }, { label: 'Raised', type: 'number' }, { label: 'End date (UTC)', type: 'date' }],
    rows: campaigns.map(campaign => [campaign.id, campaign.title, campaign.status, campaign.category, campaign.currency, campaign.goalAmount, campaign.raisedAmount, dateCell(campaign.endDate)]) }
}
export function analyticsTables(reports: AnalyticsReports, campaigns: Campaign[]): ExportTable[] {
  const counts = new Map<string, number>()
  campaigns.forEach(campaign => counts.set(campaign.status, (counts.get(campaign.status) ?? 0) + 1))
  return [
    { title: 'Monthly donations', columns: [{ label: 'Month' }, { label: 'Amount (GHS)', type: 'number' }], rows: reports.donationTrend.map(item => [item.month, item.amount]) },
    { title: 'Donations by category', columns: [{ label: 'Category' }, { label: 'Amount (GHS)', type: 'number' }], rows: reports.categoryBreakdown.map(item => [item.category, item.value]) },
    { title: 'Geographic distribution', columns: [{ label: 'Country' }, { label: 'Campaigns', type: 'number' }, { label: 'Donations (GHS)', type: 'number' }], rows: reports.geographicData.map(item => [item.country, item.campaigns, item.donations]) },
    { title: 'Fraud signals', columns: [{ label: 'Metric' }, { label: 'Value', type: 'number' }, { label: 'Change', type: 'number' }], rows: reports.fraudMetrics.map(item => [item.metric, item.value, item.change]) },
    { title: 'Campaign status', columns: [{ label: 'Status' }, { label: 'Campaigns', type: 'number' }], rows: [...counts.entries()] },
  ]
}
