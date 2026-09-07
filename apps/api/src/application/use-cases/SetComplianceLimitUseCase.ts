import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { AuditLogRepositoryPort } from '../../domain/ports/outbound/AuditLogRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface SetComplianceLimitInput {
  userId: string;
  /** null clears the override; -1 = approved unlimited; >= 0 sets a ceiling (GHS). */
  limit: number | null;
  /** The admin making the change + an optional reason, for the audit trail. */
  actorId?: string;
  actorRole?: string;
  reason?: string;
}

export interface SetComplianceLimitResult {
  userId: string;
  complianceApprovedCampaignLimit?: number;
}

/**
 * Admin/compliance action (spec §18): set or clear a user's compliance-approved
 * campaign-goal ceiling. The create-campaign gate then enforces
 * `MIN(subscription plan cap, this)`. The mutation is auto-audited by the admin
 * audit middleware. A lower limit restricts a risky account; a higher one (or -1)
 * grants an approved high-value override beyond the plan cap.
 */
export class SetComplianceLimitUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly auditLog?: AuditLogRepositoryPort
  ) {}

  async execute(input: SetComplianceLimitInput): Promise<SetComplianceLimitResult> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    const limit = input.limit === null ? undefined : input.limit;
    if (limit !== undefined && (!Number.isFinite(limit) || limit < -1)) {
      throw new AppError('Limit must be -1 (unlimited), 0, or a positive amount', 422);
    }
    const before = user.complianceApprovedCampaignLimit;
    user.setComplianceApprovedCampaignLimit(limit);
    const updated = await this.userRepo.update(user);

    if (this.auditLog && input.actorId && before !== limit) {
      await this.auditLog.record({
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: 'compliance-limit.set',
        resource: `user:${input.userId}`,
        details: `Compliance-approved campaign limit changed`,
        changes: [{ field: 'complianceApprovedCampaignLimit', before, after: limit }],
        reason: input.reason,
        severity: 'warning',
      });
    }

    return {
      userId: updated.id,
      complianceApprovedCampaignLimit: updated.complianceApprovedCampaignLimit,
    };
  }
}
