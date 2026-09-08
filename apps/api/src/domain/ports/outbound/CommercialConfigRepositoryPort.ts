export interface CommercialConfigVersion {
  key: string;
  value: number;
  effectiveFrom: Date;
  createdBy: string;
  reason?: string;
  createdAt: Date;
}

export interface CommercialConfigRepositoryPort {
  /** The currently-effective value for a key at `at` (newest effectiveFrom ≤ at), or null. */
  getEffectiveValue(key: string, at: Date): Promise<number | null>;
  /** Currently-effective values for many keys at `at`, as a { key → value } map. */
  getEffectiveMap(keys: string[], at: Date): Promise<Record<string, number>>;
  /** Append a new effective-dated value for a key. */
  setValue(input: {
    key: string;
    value: number;
    effectiveFrom: Date;
    createdBy: string;
    reason?: string;
  }): Promise<CommercialConfigVersion>;
  /** Full change history for a key (newest first). */
  history(key: string): Promise<CommercialConfigVersion[]>;
}
