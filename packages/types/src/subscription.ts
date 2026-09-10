// The v6 commercial model uses five tiers: Community / Plus / Pro / Organization
// / Enterprise. The enum VALUES are kept stable (free/starter/pro/enterprise) so
// existing subscription records need no migration — `free` presents as Community
// and `starter` as Plus; only `organization` is genuinely new.
export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ORGANIZATION = 'organization',
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
  /**
   * Plan identity/key. The built-in seed plans use the {@link SubscriptionTier}
   * values, but this is a free-form string so administrators can add NEW tiers
   * from the dashboard without a code change. Treat it as an opaque id, never as
   * a fixed enum.
   */
  tier: string
  name: string
  description: string
  /** Monthly price in GHS */
  priceMonthly: number
  /** Yearly price in GHS (discounted) */
  priceYearly: number
  /** Platform fee percentage taken from each campaign */
  platformFeePercent: number
  /** Max concurrent active campaigns */
  maxActiveCampaigns: number
  /** Max campaign goal amount in GHS */
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
  maxPayoutAccounts?: number
  maxCollaboratorsPerCampaign: number
  // ── Admin-managed presentation & lifecycle (v6 §16) ───────────────────────
  /** Display order, cheapest → richest; admins reorder without a deploy. */
  sortOrder: number
  /** Whether the plan is currently offered. Inactive plans are hidden from
   * selection but preserved so existing subscribers are not broken. */
  active: boolean
  /** Whether the plan appears on the public pricing surface (vs internal/
   * negotiated-only plans such as Enterprise). */
  isPublic: boolean
  /** UI accent colour (hex), so clients render any tier — including admin-added
   * ones — without a hardcoded per-tier colour map. */
  accentColor: string
  /** Optional "most popular" highlight on the pricing surface. */
  popular?: boolean
}

export interface Subscription {
  id: string
  userId: string
  tier: string
  status: SubscriptionStatus
  billingCycle: BillingCycle
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEnd?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * The admin-editable fields of a {@link SubscriptionPlan}. Every field is
 * optional so a plan can be patched one attribute at a time. `tier` is
 * intentionally absent — it is the plan's immutable identity/key and can never
 * be changed through an edit.
 */
export interface UpdateSubscriptionPlanInput {
  name?: string
  description?: string
  priceMonthly?: number
  priceYearly?: number
  platformFeePercent?: number
  maxActiveCampaigns?: number
  maxCampaignGoal?: number
  featuredListing?: boolean
  prioritySupport?: boolean
  advancedAnalytics?: boolean
  customBranding?: boolean
  escrowSupport?: boolean
  liveStreaming?: boolean
  campaignCollaboration?: boolean
  maxMediaPerCampaign?: number
  maxTeamMembers?: number
  maxPayoutAccounts?: number
  maxCollaboratorsPerCampaign?: number
  sortOrder?: number
  active?: boolean
  isPublic?: boolean
  accentColor?: string
  popular?: boolean
}

/**
 * Payload to CREATE a new plan/tier from the admin dashboard. `tier` is the new
 * plan's opaque id (any unused slug). All commercial fields are required so a new
 * plan is fully specified; presentation fields default sensibly if omitted.
 */
export interface CreatePlanInput {
  tier: string
  name: string
  description: string
  priceMonthly: number
  priceYearly: number
  platformFeePercent: number
  maxActiveCampaigns: number
  maxCampaignGoal: number
  featuredListing?: boolean
  prioritySupport?: boolean
  advancedAnalytics?: boolean
  customBranding?: boolean
  maxMediaPerCampaign?: number
  escrowSupport?: boolean
  liveStreaming?: boolean
  maxTeamMembers?: number
  campaignCollaboration?: boolean
  maxPayoutAccounts?: number
  maxCollaboratorsPerCampaign?: number
  sortOrder?: number
  active?: boolean
  isPublic?: boolean
  accentColor?: string
  popular?: boolean
}

export interface CreateSubscriptionInput {
  tier: string
  billingCycle: BillingCycle
}

export interface UpgradeSubscriptionInput {
  tier: string
  billingCycle?: BillingCycle
}

// ── Paid-subscription Paystack checkout rail ────────────────────────────────
// Mirrors DonationIntent: create a PENDING checkout, redirect to Paystack, and
// settle it (activate the subscription, redeem the coupon, award the affiliate
// commission) exactly once from the signed webhook's charge.success.

export enum SubscriptionCheckoutStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export interface CreateSubscriptionCheckoutInput {
  tier: string // must be a paid tier
  billingCycle: BillingCycle
  couponCode?: string
}

export interface SubscriptionCheckout {
  id: string
  userId: string
  tier: string
  billingCycle: BillingCycle
  status: SubscriptionCheckoutStatus
  baseAmount: number
  discountAmount: number
  finalAmount: number
  currency: string
  couponId?: string
  couponCode?: string
  providerRef?: string
  createdAt: Date
  updatedAt: Date
}

export interface SubscriptionCheckoutResult {
  checkout: SubscriptionCheckout
  /** Present when a Paystack charge is required; absent when finalAmount is 0 (activated immediately). */
  authorizationUrl?: string
  accessCode?: string
  reference?: string
  /** True when a 100%/fixed coupon zeroed the price and the subscription was activated with no charge. */
  activatedWithoutCharge?: boolean
  preview: { baseAmount: number; discountAmount: number; finalAmount: number; currency: string }
}

/** The plan limits that should be enforced */
export interface PlanLimits {
  tier: string
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

/**
 * Seed plan configurations (v6 commercial model). These are the INITIAL values
 * only — plans are DB-backed and admin-editable, and administrators may add
 * further tiers from the dashboard. Code reads plans through the API/PlanService,
 * never this constant directly (except as the seed + offline fallback).
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  [SubscriptionTier.FREE]: {
    tier: SubscriptionTier.FREE,
    name: 'Community',
    description: 'Free for individuals and small community causes',
    priceMonthly: 0,
    priceYearly: 0,
    platformFeePercent: 3.5,
    maxActiveCampaigns: 1,
    maxCampaignGoal: 10000,
    featuredListing: false,
    prioritySupport: false,
    advancedAnalytics: false,
    customBranding: false,
    maxMediaPerCampaign: 3,
    escrowSupport: false,
    liveStreaming: false,
    maxTeamMembers: 1,
    campaignCollaboration: false,
    maxPayoutAccounts: 1,
    maxCollaboratorsPerCampaign: 0,
    sortOrder: 0,
    active: true,
    isPublic: true,
    accentColor: '#78909C',
  },
  [SubscriptionTier.STARTER]: {
    tier: SubscriptionTier.STARTER,
    name: 'Plus',
    description: 'For serious individual fundraisers running a few causes',
    priceMonthly: 49,
    priceYearly: 490,
    platformFeePercent: 3.0,
    maxActiveCampaigns: 3,
    maxCampaignGoal: 50000,
    featuredListing: false,
    prioritySupport: false,
    advancedAnalytics: false,
    customBranding: true,
    maxMediaPerCampaign: 10,
    escrowSupport: false,
    liveStreaming: false,
    maxTeamMembers: 1,
    campaignCollaboration: false,
    maxPayoutAccounts: 2,
    maxCollaboratorsPerCampaign: 0,
    sortOrder: 1,
    active: true,
    isPublic: true,
    accentColor: '#1565C0',
  },
  [SubscriptionTier.PRO]: {
    tier: SubscriptionTier.PRO,
    name: 'Pro',
    description: 'For creators, groups and frequent fundraisers',
    priceMonthly: 149,
    priceYearly: 1490,
    platformFeePercent: 2.5,
    maxActiveCampaigns: 10,
    maxCampaignGoal: 250000,
    featuredListing: true,
    prioritySupport: true,
    advancedAnalytics: true,
    customBranding: true,
    maxMediaPerCampaign: 25,
    escrowSupport: true,
    liveStreaming: true,
    maxTeamMembers: 3,
    campaignCollaboration: true,
    maxPayoutAccounts: 3,
    maxCollaboratorsPerCampaign: 3,
    sortOrder: 2,
    active: true,
    isPublic: true,
    accentColor: '#2E3D2F',
    popular: true,
  },
  [SubscriptionTier.ORGANIZATION]: {
    tier: SubscriptionTier.ORGANIZATION,
    name: 'Organization',
    description: 'For NGOs, churches, schools and associations',
    priceMonthly: 399,
    priceYearly: 3990,
    platformFeePercent: 2.0,
    maxActiveCampaigns: 25,
    maxCampaignGoal: 1000000,
    featuredListing: true,
    prioritySupport: true,
    advancedAnalytics: true,
    customBranding: true,
    maxMediaPerCampaign: 50,
    escrowSupport: true,
    liveStreaming: true,
    maxTeamMembers: 10,
    campaignCollaboration: true,
    maxPayoutAccounts: 5,
    maxCollaboratorsPerCampaign: 10,
    sortOrder: 3,
    active: true,
    isPublic: true,
    accentColor: '#8B6F4E',
  },
  [SubscriptionTier.ENTERPRISE]: {
    tier: SubscriptionTier.ENTERPRISE,
    name: 'Enterprise',
    description: 'For large institutions and major programs (from GHS 1,500; negotiated)',
    priceMonthly: 1500,
    priceYearly: 15000,
    platformFeePercent: 1.25,
    maxActiveCampaigns: -1, // unlimited (fair-use / negotiated)
    maxCampaignGoal: -1, // unlimited (GHS 5M+ subject to approval)
    featuredListing: true,
    prioritySupport: true,
    advancedAnalytics: true,
    customBranding: true,
    maxMediaPerCampaign: -1, // unlimited
    escrowSupport: true,
    liveStreaming: true,
    maxTeamMembers: -1, // unlimited
    campaignCollaboration: true,
    maxPayoutAccounts: -1,
    maxCollaboratorsPerCampaign: -1, // unlimited
    sortOrder: 4,
    active: true,
    isPublic: true,
    accentColor: '#6A1B9A',
  },
}
