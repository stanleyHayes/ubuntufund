import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { CreatorProfileRepositoryPort } from '../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import type { TipRepositoryPort } from '../../domain/ports/outbound/TipRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Public creator tip page (no auth): profile + aggregate stats + recent tips. */
export class GetCreatorByHandleUseCase {
  constructor(
    private readonly profileRepo: CreatorProfileRepositoryPort,
    private readonly tipRepo: TipRepositoryPort,
    private readonly plans: PlanLimitsService
  ) {}

  async execute(handle: string) {
    const p = await this.profileRepo.findByHandle(handle);
    if (!p) throw new AppError('Creator not found', 404);
    const policy = await this.plans.creatorPolicy(p.userId);
    const stats = await this.tipRepo.creatorStats(p.userId);
    const recent = await this.tipRepo.findByCreator(p.userId, 10);
    return {
      handle: p.handle,
      displayName: p.displayName,
      tagline: p.tagline,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      tipsEnabled: p.tipsEnabled && policy.eligible,
      presetAmounts: p.presetAmounts,
      currency: p.currency,
      thankYouMessage: p.thankYouMessage,
      supporterCount: stats.count,
      totalReceived: stats.totalNet,
      recentTips: recent.map((t) => ({
        supporterName: t.isAnonymous ? 'Anonymous' : t.supporterName || 'Someone',
        amount: t.amount,
        message: t.message,
      })),
    };
  }
}
