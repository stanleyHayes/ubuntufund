import type {
  AuditLogEntry,
  AuditLogRepositoryPort,
} from '../../../../domain/ports/outbound/AuditLogRepositoryPort.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { logger } from '../../../logging/logger.js';

/**
 * Persists semantic audit entries. Best-effort: a failed audit write is logged
 * but never throws, so it can never fail the underlying admin action.
 */
export class MongoAuditLogRepository implements AuditLogRepositoryPort {
  async record(entry: AuditLogEntry): Promise<void> {
    try {
      await AuditLogModel.create({
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        resource: entry.resource,
        details: entry.details,
        severity: entry.severity ?? 'info',
        // Use-case-originated (not an HTTP request); sentinel transport fields.
        method: 'INTERNAL',
        path: `internal:${entry.action}`,
        statusCode: 200,
        changes: entry.changes,
        reason: entry.reason,
      });
    } catch (error) {
      logger.error({ error, action: entry.action }, 'audit log write failed');
    }
  }
}
