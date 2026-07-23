export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  TRIALING = 'trialing',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export interface SubscriptionPlan {
  tier: SubscriptionTier
  name: string
  description: string
  /** Monthly price in USD */
  priceMonthly: number
  /** Yearly price in USD (discounted) */
  priceYearly: number
  /** Platform fee percentage taken from each campaign */
  platformFeePercent: number
  /** Max concurrent active campaigns */
  maxActiveCampaigns: number
  /** Max campaign goal amount in USD equivalent */
  maxCampaignGoal: number
  /** Whether campaign gets featured/boosted visibility */
  featuredListing: boolean
  /** Whether campaign appears in search results with priority */
  prioritySupport: boolean
  /** Whether analytics dashboard is available */
  advancedAnalytics: boolean
  /** Whether custom branding on campaign page is allowed */
  customBranding: boolean
  /** Max media uploads per campaign */
  maxMediaPerCampaign: number
  /** Whether escrow/milestone features are available */
  escrowSupport: boolean
  /** Whether live fundraising streaming is available */
  liveStreaming: boolean
  /** Max team members (org only) */
  maxTeamMembers: number
  /** Whether campaign collaboration (co-campaigns) is available */
  campaignCollaboration: boolean
  /** Max collaborators per campaign (-1 = unlimited) */
  maxCollaboratorsPerCampaign: number
}

export interface Subscription {
  id: string
  userId: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  billingCycle: BillingCycle
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEnd?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CreateSubscriptionInput {
  tier: SubscriptionTier
  billingCycle: BillingCycle
}

export interface UpgradeSubscriptionInput {
  tier: SubscriptionTier
  billingCycle?: BillingCycle
}

/** The plan limits that should be enforced */
export interface PlanLimits {
  tier: SubscriptionTier
  maxActiveCampaigns: number
  maxCampaignGoal: number
  platformFeePercent: number
  featuredListing: boolean
  maxMediaPerCampaign: number
  escrowSupport: boolean
  liveStreaming: boolean
  maxTeamMembers: number
  campaignCollaboration: boolean
  maxCollaboratorsPerCampaign: number
}

/** Predefined plan configurations */
export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  [SubscriptionTier.FREE]: {
    tier: SubscriptionTier.FREE,
    name: 'Free',
    description: 'Get started with basic crowdfunding',
    priceMonthly: 0,
    priceYearly: 0,
    platformFeePercent: 5,
    maxActiveCampaigns: 1,
    maxCampaignGoal: 5000,
    featuredListing: false,
    prioritySupport: false,
    advancedAnalytics: false,
    customBranding: false,
    maxMediaPerCampaign: 3,
    escrowSupport: false,
    liveStreaming: false,
    maxTeamMembers: 1,
    campaignCollaboration: false,
    maxCollaboratorsPerCampaign: 0,
  },
  [SubscriptionTier.STARTER]: {
    tier: SubscriptionTier.STARTER,
    name: 'Starter',
    description: 'For individuals and small causes',
    priceMonthly: 9.99,
    priceYearly: 99,
    platformFeePercent: 3.5,
    maxActiveCampaigns: 3,
    maxCampaignGoal: 25000,
    featuredListing: false,
    prioritySupport: false,
    advancedAnalytics: false,
    customBranding: false,
    maxMediaPerCampaign: 10,
    escrowSupport: false,
    liveStreaming: false,
    maxTeamMembers: 2,
    campaignCollaboration: false,
    maxCollaboratorsPerCampaign: 0,
  },
  [SubscriptionTier.PRO]: {
    tier: SubscriptionTier.PRO,
    name: 'Pro',
    description: 'For serious fundraisers and organizations',
    priceMonthly: 29.99,
    priceYearly: 299,
    platformFeePercent: 2,
    maxActiveCampaigns: 10,
    maxCampaignGoal: 100000,
    featuredListing: true,
    prioritySupport: true,
    advancedAnalytics: true,
    customBranding: true,
    maxMediaPerCampaign: 25,
    escrowSupport: true,
    liveStreaming: false,
    maxTeamMembers: 5,
    campaignCollaboration: true,
    maxCollaboratorsPerCampaign: 3,
  },
  [SubscriptionTier.ENTERPRISE]: {
    tier: SubscriptionTier.ENTERPRISE,
    name: 'Enterprise',
    description: 'For NGOs, hospitals, schools, and large organizations',
    priceMonthly: 99.99,
    priceYearly: 999,
    platformFeePercent: 1,
    maxActiveCampaigns: -1, // unlimited
    maxCampaignGoal: -1, // unlimited
    featuredListing: true,
    prioritySupport: true,
    advancedAnalytics: true,
    customBranding: true,
    maxMediaPerCampaign: -1, // unlimited
    escrowSupport: true,
    liveStreaming: true,
    maxTeamMembers: -1, // unlimited
    campaignCollaboration: true,
    maxCollaboratorsPerCampaign: -1, // unlimited
  },
}
