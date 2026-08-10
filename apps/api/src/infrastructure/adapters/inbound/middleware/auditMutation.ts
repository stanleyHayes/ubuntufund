import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './authMiddleware.js';
import { AuditLogModel, type AuditSeverity } from '../../../database/models/AuditLogModel.js';
import { logger } from '../../../logging/logger.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function describeAction(method: string, path: string): {
  action: string;
  resource: string;
} {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  const apiIndex = segments.findIndex((segment) => segment === 'v1');
  const resource = segments[apiIndex + 1] ?? segments[0] ?? 'unknown';
  const operation =
    method === 'POST' ? 'create' :
    method === 'PUT' || method === 'PATCH' ? 'update' : 'delete';
  return { action: `${resource}.${operation}`, resource };
}

function severityFor(statusCode: number, method: string): AuditSeverity {
  if (statusCode >= 500) return 'critical';
  if (statusCode >= 400 || method === 'DELETE') return 'warning';
  return 'info';
}

/**
 * Persist successful authenticated state changes without recording request
 * bodies, tokens, passwords, or other sensitive payload data.
 */
export function auditMutation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!MUTATION_METHODS.has(req.method)) {
    next();
    return;
  }

  res.on('finish', () => {
    if (!req.userId || res.statusCode >= 500) return;
    const { action, resource } = describeAction(req.method, req.originalUrl);
    void AuditLogModel.create({
      actorId: req.userId,
      actorRole: req.userRole,
      action,
      resource,
      details: `${req.method} ${req.originalUrl.split('?')[0]}`,
      severity: severityFor(res.statusCode, req.method),
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }).catch((error: unknown) => {
      logger.error({ error, path: req.originalUrl }, 'audit log write failed');
    });
  });

  next();
}
