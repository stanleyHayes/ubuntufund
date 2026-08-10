import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';

export class AuditLogController {
  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, Number.parseInt(req.query.pageSize as string, 10) || 25)
      );
      const skip = (page - 1) * pageSize;
      const search = String(req.query.search ?? '').trim();
      const filter = search
        ? {
            $or: ['actorId', 'action', 'resource', 'details'].map((field) => ({
              [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
            })),
          }
        : {};

      const [documents, total] = await Promise.all([
        AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
        AuditLogModel.countDocuments(filter),
      ]);

      res.json({
        data: {
          items: documents.map((entry) => ({
            id: entry._id!.toString(),
            timestamp: entry.createdAt,
            user: entry.actorRole
              ? `${entry.actorRole} · ${entry.actorId}`
              : entry.actorId,
            action: entry.action,
            resource: entry.resource,
            details: entry.details,
            severity: entry.severity,
          })),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        message: 'Audit entries retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
