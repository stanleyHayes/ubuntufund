export interface LegalAcceptanceEvent {
  userId: string;
  version: string;
  acceptedTerms: boolean;
  ageConfirmed: boolean;
  acceptedAt: Date;
  source: 'register' | 'reaccept' | 'backfill';
  ip?: string;
  userAgent?: string;
}

/** Append-only consent evidence; never updated or deleted by application code. */
export interface LegalAcceptanceLogPort {
  record(event: LegalAcceptanceEvent): Promise<void>;
}
