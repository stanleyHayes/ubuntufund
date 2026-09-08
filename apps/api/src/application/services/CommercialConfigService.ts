import type { CommercialConfigRepositoryPort, CommercialConfigVersion } from '../../domain/ports/outbound/CommercialConfigRepositoryPort.js';
import type { PayoutsConfig } from '../../infrastructure/config/index.js';

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
    private readonly defaults: PayoutsConfig
  ) {
    this.keys = Object.keys(defaults).filter(
      (k) =>
        typeof (defaults as unknown as Record<string, unknown>)[k] === 'number' &&
        !CommercialConfigService.APPROVE_TIME_ONLY.has(k)
    ) as (keyof PayoutsConfig)[];
  }

  isKnownKey(key: string): key is keyof PayoutsConfig & string {
    return (this.keys as string[]).includes(key);
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
    key: keyof PayoutsConfig & string,
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
