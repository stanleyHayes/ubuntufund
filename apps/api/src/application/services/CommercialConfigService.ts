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
    return [...(this.keys as string[]), ...affiliate, ...campaigns];
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
