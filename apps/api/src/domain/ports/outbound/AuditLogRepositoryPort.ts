/** A semantic audit entry for a sensitive change (ADR-5), written by a use case. */
export interface AuditLogEntry {
  actorId: string;
  actorRole?: string;
  /** Dotted action key, e.g. `subscription-plan.pricing`. */
  action: string;
  resource: string;
  details: string;
  /** Old→new values for the fields that changed. */
  changes?: { field: string; before: unknown; after: unknown }[];
  reason?: string;
  severity?: 'info' | 'warning' | 'critical';
}

/**
 * Writes the immutable audit trail (ADR-5). The HTTP middleware records the
 * transport-level "who did a mutation" entry; this port lets a use case add the
 * richer semantic entry that carries the old→new value diff for sensitive
 * money/commercial config.
 */
export interface AuditLogRepositoryPort {
  record(entry: AuditLogEntry): Promise<void>;
}
