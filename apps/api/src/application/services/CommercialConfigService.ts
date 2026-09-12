import type { CommercialConfigRepositoryPort, CommercialConfigVersion } from '../../domain/ports/outbound/CommercialConfigRepositoryPort.js';
import type { AffiliateConfig, PayoutsConfig } from '../../infrastructure/config/index.js';

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
    private readonly affiliateDefaults?: AffiliateConfig
  ) {
    this.keys = Object.keys(defaults).filter(
      (k) =>
        typeof (defaults as unknown as Record<string, unknown>)[k] === 'number' &&
        !CommercialConfigService.APPROVE_TIME_ONLY.has(k)
    ) as (keyof PayoutsConfig)[];
  }

  /** Every key an admin may set: the payout fields plus the affiliate ones. */
  get allKeys(): string[] {
    const affiliate = this.affiliateDefaults ? [AFFILIATE_REFERRAL_DISCOUNT_KEY] : [];
    return [...(this.keys as string[]), ...affiliate];
  }

  isKnownKey(key: string): boolean {
    return this.allKeys.includes(key);
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
