import type { CommercialConfigRepositoryPort, CommercialConfigVersion } from '../../domain/ports/outbound/CommercialConfigRepositoryPort.js';
import type {
  AffiliateConfig,
  CampaignsConfig,
  PayoutsConfig,
} from '../../infrastructure/config/index.js';

/**
 * Affiliate keys an admin may override, namespaced so they cannot collide with
 * a PayoutsConfig field of the same name.
 *
 * Only `referralDiscountPercent` is here, and the omissions are deliberate.
 * `commissionPercent` and `holdDays` are read from the static config by
 * AffiliateCommissionService at accrual time, so advertising them would let an
 * admin "set" a rate that silently never takes effect — the same trap
 * APPROVE_TIME_ONLY exists to avoid below. They stay deploy-time settings until
 * that service resolves them through this store too.
 */
export const AFFILIATE_REFERRAL_DISCOUNT_KEY = 'affiliate.referralDiscountPercent';

/**
 * Where "a campaign is waiting for review" alerts are sent.
 *
 * A text setting, not a number — the only one so far, which is why the store
 * grew a separate text column rather than overloading `value`.
 */
export const REVIEW_ALERT_EMAIL_KEY = 'alerts.reviewEmail';

/** The highest campaign tier that goes live without a human reviewing it. */
export const CAMPAIGN_AUTO_APPROVE_TIER_KEY = 'campaigns.autoApproveMaxTier';

/**
 * The four ascending goal boundaries that split campaigns into tiers 1–5.
 *
 * Stored as four separate keys because the store holds one number per key. That
 * is a fair trade: each boundary keeps its own history, so "who widened tier 2
 * and when" is answerable, which a single packed value would lose.
 */
export const CAMPAIGN_TIER_THRESHOLD_KEYS = [
  'campaigns.tierThreshold1',
  'campaigns.tierThreshold2',
  'campaigns.tierThreshold3',
  'campaigns.tierThreshold4',
] as const;

/**
 * Campaigns run on someone else's behalf. Switches are stored as 0/1 because
 * the store holds numbers. Each is copied onto a campaign at creation, so a
 * change only affects campaigns created afterwards.
 */
export const ON_BEHALF_CONFIG_DEFAULTS = {
  /** The beneficiary must accept before staff can publish the campaign. */
  'onBehalf.publicationRequiresConsent': 1,
  /** No donations until the beneficiary accepts, even if the campaign is live. */
  'onBehalf.donationsRequireConsent': 1,
  /** Every on-behalf campaign waits for staff review, whatever its tier. */
  'onBehalf.staffReviewRequired': 1,
  /** How long a beneficiary invitation link stays valid. */
  'onBehalf.invitationTtlHours': 168,
  /** Minimum verification level of the creating account (0 = the normal campaign rules). */
  'onBehalf.minManagerVerificationLevel': 0,
} as const

/** Post-campaign donor thank-you messages. */
export const THANK_YOU_CONFIG_DEFAULTS = {
  'thankYou.enabled': 1,
  /** Unlock the thank-you once the campaign has ended. */
  'thankYou.afterCampaignEnd': 1,
  /** Unlock the thank-you once any payout from the campaign has been paid. */
  'thankYou.afterPayoutPaid': 1,
  /** Completion thank-yous a campaign may send. */
  'thankYou.maxSendsPerCampaign': 1,
} as const

export type OnBehalfConfigKey = keyof typeof ON_BEHALF_CONFIG_DEFAULTS
export type ThankYouConfigKey = keyof typeof THANK_YOU_CONFIG_DEFAULTS

export interface OnBehalfSettings {
  publicationRequiresConsent: boolean
  donationsRequireConsent: boolean
  staffReviewRequired: boolean
  invitationTtlHours: number
  minManagerVerificationLevel: number
}

export interface ThankYouSettings {
  enabled: boolean
  afterCampaignEnd: boolean
  afterPayoutPaid: boolean
  maxSendsPerCampaign: number
}

const FEATURE_DEFAULTS: Record<string, number> = { ...ON_BEHALF_CONFIG_DEFAULTS, ...THANK_YOU_CONFIG_DEFAULTS }

/** Keys that are on/off switches: only 0 or 1 is valid. */
const SWITCH_KEYS: ReadonlySet<string> = new Set([
  'onBehalf.publicationRequiresConsent',
  'onBehalf.donationsRequireConsent',
  'onBehalf.staffReviewRequired',
  'thankYou.enabled',
  'thankYou.afterCampaignEnd',
  'thankYou.afterPayoutPaid',
])

/** Whole-number ranges for the remaining feature keys. */
const RANGES: Record<string, [number, number]> = {
  'onBehalf.invitationTtlHours': [1, 720],
  'onBehalf.minManagerVerificationLevel': [0, 4],
  'thankYou.maxSendsPerCampaign': [1, 10],
}

/**
 * Resolves the effective commercial config (ADR-5): each key is the currently
 * effective versioned override, falling back to the env default when unset — so
 * behaviour is IDENTICAL to today until an admin explicitly sets a value. Reads
 * are cached for a short TTL and invalidated on write.
 */
export class CommercialConfigService {
  private cache: { at: number; cfg: PayoutsConfig } | null = null;
  private readonly ttlMs = 30_000;
  /** The numeric keys an admin may override (the PayoutsConfig fields). */
  readonly keys: (keyof PayoutsConfig)[];

  /**
   * PayoutsConfig fields consumed only at APPROVE time (ApprovePayoutUseCase and
   * BeneficiaryPayoutUseCase read these from the static env config, not this
   * store). They are deliberately NOT overridable here: advertising them would
   * let an admin "set" a maker-checker threshold or transfer ceiling that
   * silently never takes effect. They stay env-configured (a deploy-time change),
   * which is appropriate for a security/limit control.
   */
  private static readonly APPROVE_TIME_ONLY: ReadonlySet<string> = new Set([
    'dualApprovalAmount',
    'maxTransferAmount',
  ]);

  constructor(
    private readonly repo: CommercialConfigRepositoryPort,
    private readonly defaults: PayoutsConfig,
    private readonly affiliateDefaults?: AffiliateConfig,
    private readonly campaignDefaults?: CampaignsConfig
  ) {
    this.keys = Object.keys(defaults).filter(
      (k) =>
        typeof (defaults as unknown as Record<string, unknown>)[k] === 'number' &&
        !CommercialConfigService.APPROVE_TIME_ONLY.has(k)
    ) as (keyof PayoutsConfig)[];
  }

  /** Every key an admin may set: payouts, plus affiliate and campaign levers. */
  get allKeys(): string[] {
    const affiliate = this.affiliateDefaults ? [AFFILIATE_REFERRAL_DISCOUNT_KEY] : [];
    const campaigns = this.campaignDefaults
      ? [CAMPAIGN_AUTO_APPROVE_TIER_KEY, ...CAMPAIGN_TIER_THRESHOLD_KEYS]
      : [];
    return [...(this.keys as string[]), ...affiliate, ...campaigns, ...Object.keys(FEATURE_DEFAULTS)];
  }

  /** Defaults for the on-behalf and thank-you keys, for admin display. */
  getFeatureDefaults(): Record<string, number> {
    return { ...FEATURE_DEFAULTS };
  }

  /** Why a value is invalid for a feature key, or null when it is fine (or not a feature key). */
  featureValueError(key: string, value: number): string | null {
    if (SWITCH_KEYS.has(key)) return value === 0 || value === 1 ? null : 'Use 1 to turn this on or 0 to turn it off.';
    const range = RANGES[key];
    if (!range) return null;
    if (!Number.isInteger(value) || value < range[0] || value > range[1]) return `Use a whole number from ${range[0]} to ${range[1]}.`;
    return null;
  }

  /** Effective values of every on-behalf and thank-you key. Read per call so a change applies at once. */
  async resolveFeatureValues(): Promise<Record<string, number>> {
    const map = await this.repo.getEffectiveMap(Object.keys(FEATURE_DEFAULTS), new Date());
    const values: Record<string, number> = {};
    for (const [key, fallback] of Object.entries(FEATURE_DEFAULTS)) {
      const stored = map[key];
      values[key] = typeof stored === 'number' && this.featureValueError(key, stored) === null ? stored : fallback;
    }
    return values;
  }

  async resolveOnBehalfConfig(): Promise<OnBehalfSettings> {
    const v = await this.resolveFeatureValues();
    return {
      publicationRequiresConsent: v['onBehalf.publicationRequiresConsent'] === 1,
      donationsRequireConsent: v['onBehalf.donationsRequireConsent'] === 1,
      staffReviewRequired: v['onBehalf.staffReviewRequired'] === 1,
      invitationTtlHours: v['onBehalf.invitationTtlHours'],
      minManagerVerificationLevel: v['onBehalf.minManagerVerificationLevel'],
    };
  }

  async resolveThankYouConfig(): Promise<ThankYouSettings> {
    const v = await this.resolveFeatureValues();
    return {
      enabled: v['thankYou.enabled'] === 1,
      afterCampaignEnd: v['thankYou.afterCampaignEnd'] === 1,
      afterPayoutPaid: v['thankYou.afterPayoutPaid'] === 1,
      maxSendsPerCampaign: v['thankYou.maxSendsPerCampaign'],
    };
  }

  /**
   * The effective campaign tiering rules.
   *
   * Resolved per call, not cached with the payouts config: an admin tightening
   * review during a fraud wave needs the next campaign to obey, not the one
   * after the cache expires.
   */
  async resolveCampaignsConfig(): Promise<CampaignsConfig> {
    const defaults = this.campaignDefaults;
    if (!defaults) throw new Error('Campaign config defaults were not provided');

    const map = await this.repo.getEffectiveMap(
      [CAMPAIGN_AUTO_APPROVE_TIER_KEY, ...CAMPAIGN_TIER_THRESHOLD_KEYS],
      new Date()
    );

    const autoApproveMaxTier = map[CAMPAIGN_AUTO_APPROVE_TIER_KEY];
    // A threshold set to 0 would collapse a tier boundary rather than mean
    // "unset", so only a real number replaces the default — and the set stays
    // ascending, because deriveCampaignTier counts boundaries a goal exceeds
    // and an out-of-order list would silently mis-tier every campaign.
    const thresholds = CAMPAIGN_TIER_THRESHOLD_KEYS.map((key, i) => {
      const value = map[key];
      return typeof value === 'number' && value > 0 ? value : defaults.tierThresholds[i];
    })
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      .sort((a, b) => a - b);

    return {
      tierThresholds: thresholds.length > 0 ? thresholds : defaults.tierThresholds,
      autoApproveMaxTier:
        typeof autoApproveMaxTier === 'number'
          ? autoApproveMaxTier
          : defaults.autoApproveMaxTier,
    };
  }

  isKnownKey(key: string): boolean {
    return this.allKeys.includes(key) || this.isTextKey(key);
  }

  /** Whether a key holds text rather than a number. */
  isTextKey(key: string): boolean {
    return key === REVIEW_ALERT_EMAIL_KEY;
  }

  /**
   * The address review alerts go to, or null to disable them.
   *
   * Null rather than falling back to the env default once an admin has set a
   * value: clearing the field is how you turn the alerts off, and coalescing an
   * empty string back to the default would make that impossible.
   */
  async resolveReviewAlertEmail(fallback: string): Promise<string> {
    const stored = await this.repo.getEffectiveText(REVIEW_ALERT_EMAIL_KEY, new Date());
    return stored === null ? fallback : stored;
  }

  async setTextValue(
    key: string,
    textValue: string,
    createdBy: string,
    effectiveFrom: Date,
    reason?: string
  ): Promise<CommercialConfigVersion> {
    const v = await this.repo.setText({ key, textValue, effectiveFrom, createdBy, reason });
    this.cache = null;
    return v;
  }

  /**
   * The effective affiliate referral discount, as a percentage of the plan
   * price. Resolved per call rather than cached alongside the payouts config:
   * this is a live pricing lever an admin flips in the dashboard, and a stale
   * read means quoting a customer a discount the platform is no longer giving.
   */
  async resolveReferralDiscountPercent(): Promise<number> {
    const fallback = this.affiliateDefaults?.referralDiscountPercent ?? 0;
    const map = await this.repo.getEffectiveMap(
      [AFFILIATE_REFERRAL_DISCOUNT_KEY],
      new Date()
    );
    const value = map[AFFILIATE_REFERRAL_DISCOUNT_KEY];
    return typeof value === 'number' ? value : fallback;
  }

  /** The effective payouts config (overrides layered over env defaults). */
  async resolvePayoutsConfig(): Promise<PayoutsConfig> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) return this.cache.cfg;
    const map = await this.repo.getEffectiveMap(this.keys as string[], new Date());
    const cfg: PayoutsConfig = { ...this.defaults };
    for (const k of this.keys) {
      const v = map[k as string];
      if (typeof v === 'number') (cfg as unknown as Record<string, number>)[k as string] = v;
    }
    this.cache = { at: Date.now(), cfg };
    return cfg;
  }

  /** The env defaults, for admin display (baseline before any override). */
  getDefaults(): PayoutsConfig {
    return { ...this.defaults };
  }

  async setValue(
    key: string,
    value: number,
    createdBy: string,
    effectiveFrom: Date,
    reason?: string
  ): Promise<CommercialConfigVersion> {
    const v = await this.repo.setValue({ key, value, effectiveFrom, createdBy, reason });
    this.cache = null; // invalidate
    return v;
  }

  history(key: string): Promise<CommercialConfigVersion[]> {
    return this.repo.history(key);
  }
}
