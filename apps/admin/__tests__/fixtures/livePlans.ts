import type { SubscriptionPlan } from '@ubuntu-fund/types'

/**
 * The production plans as GET /plans/public returned them on 2026-09-30: the
 * legacy Free/Starter/Pro rows, the v6 Organization row and the hand-edited
 * Enterprise row (on-behalf switched on with 0 allowed, and the same sortOrder
 * as Organization). Legacy rows carry no maxCollaboratorsPerCampaign.
 */
export const LIVE_PLANS = [
  { tier: 'free', name: 'Free', description: 'Get started with basic crowdfunding', priceMonthly: 0, priceYearly: 0, platformFeePercent: 5, maxActiveCampaigns: 1, maxCampaignGoal: 5000, featuredListing: false, prioritySupport: false, advancedAnalytics: false, customBranding: false, maxMediaPerCampaign: 3, escrowSupport: false, liveStreaming: false, maxTeamMembers: 1, campaignCollaboration: false, maxPayoutAccounts: 1, onBehalfCampaigns: false, maxOnBehalfCampaigns: 0, onBehalfFeePercent: 0, sortOrder: 0, active: true, isPublic: true, accentColor: '#78909C', popular: false },
  { tier: 'starter', name: 'Starter', description: 'For individuals and small causes', priceMonthly: 9.99, priceYearly: 99, platformFeePercent: 3.5, maxActiveCampaigns: 3, maxCampaignGoal: 25000, featuredListing: false, prioritySupport: false, advancedAnalytics: false, customBranding: false, maxMediaPerCampaign: 10, escrowSupport: false, liveStreaming: false, maxTeamMembers: 2, campaignCollaboration: false, maxPayoutAccounts: 2, onBehalfCampaigns: false, maxOnBehalfCampaigns: 0, onBehalfFeePercent: 0, sortOrder: 1, active: true, isPublic: true, accentColor: '#78909C', popular: false },
  { tier: 'pro', name: 'Pro', description: 'For serious fundraisers and organizations', priceMonthly: 29.99, priceYearly: 299, platformFeePercent: 2, maxActiveCampaigns: 10, maxCampaignGoal: 100000, featuredListing: true, prioritySupport: true, advancedAnalytics: true, customBranding: true, maxMediaPerCampaign: 25, escrowSupport: true, liveStreaming: false, maxTeamMembers: 5, campaignCollaboration: false, maxPayoutAccounts: 3, onBehalfCampaigns: false, maxOnBehalfCampaigns: 0, onBehalfFeePercent: 0, sortOrder: 2, active: true, isPublic: true, accentColor: '#78909C', popular: false },
  { tier: 'organization', name: 'Organization', description: 'For NGOs, churches, schools and associations', priceMonthly: 399, priceYearly: 3990, platformFeePercent: 2, maxActiveCampaigns: 25, maxCampaignGoal: 1000000, featuredListing: true, prioritySupport: true, advancedAnalytics: true, customBranding: true, maxMediaPerCampaign: 50, escrowSupport: true, liveStreaming: true, maxTeamMembers: 10, campaignCollaboration: true, maxPayoutAccounts: 5, maxCollaboratorsPerCampaign: 10, onBehalfCampaigns: false, maxOnBehalfCampaigns: 0, onBehalfFeePercent: 0, sortOrder: 3, active: true, isPublic: true, accentColor: '#8B6F4E', popular: false },
  { tier: 'enterprise', name: 'Enterprise', description: 'For NGOs, hospitals, schools, and large organizations', priceMonthly: 999.99, priceYearly: 9999.9, platformFeePercent: 1, maxActiveCampaigns: -1, maxCampaignGoal: -1, featuredListing: true, prioritySupport: true, advancedAnalytics: true, customBranding: true, maxMediaPerCampaign: -1, escrowSupport: true, liveStreaming: true, maxTeamMembers: -1, campaignCollaboration: true, maxPayoutAccounts: -1, onBehalfCampaigns: true, maxOnBehalfCampaigns: 0, onBehalfFeePercent: 0, sortOrder: 3, active: true, isPublic: true, accentColor: '#78909C', popular: false },
] as SubscriptionPlan[]

/** One live plan by tier id. */
export function livePlan(tier: string): SubscriptionPlan {
  const plan = LIVE_PLANS.find((candidate) => candidate.tier === tier)
  if (!plan) throw new Error(`No live plan fixture for ${tier}`)
  return plan
}
