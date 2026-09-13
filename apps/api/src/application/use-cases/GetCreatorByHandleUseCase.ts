import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { CreatorProfileRepositoryPort } from '../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import type { TipRepositoryPort } from '../../domain/ports/outbound/TipRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Public creator tip page (no auth): profile + aggregate stats + recent tips. */
export class GetCreatorByHandleUseCase {
  constructor(
    private readonly profileRepo: CreatorProfileRepositoryPort,
    private readonly tipRepo: TipRepositoryPort,
    private readonly plans: PlanLimitsService,
    private readonly visibility: PublicProfileVisibilityPort
  ) {}

  async execute(handle: string, viewerId?: string) {
    const p = await this.profileRepo.findByHandle(handle);
    if (!p || (await this.visibility.hiddenContentAuthorIds([p.userId], viewerId)).has(p.userId)) throw new AppError('Creator not found', 404);
    const policy = await this.plans.creatorPolicy(p.userId);
    const stats = await this.tipRepo.creatorStats(p.userId);
    const recent = await this.tipRepo.findByCreator(p.userId, 10);
    const excluded = await this.visibility.hiddenContentAuthorIds(recent.map(tip => tip.toPlain().supporterUserId).filter((id): id is string => !!id), viewerId);
    return {
      userId: p.userId,
      handle: p.handle,
      displayName: p.displayName,
      tagline: p.tagline,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      coverUrl: p.coverUrl,
      tipsEnabled: p.tipsEnabled && policy.eligible,
      presetAmounts: p.presetAmounts,
      currency: p.currency,
      thankYouMessage: p.thankYouMessage,
      supporterCount: stats.count,
      totalReceived: stats.totalNet,
      recentTips: recent.filter(t => !excluded.has(t.toPlain().supporterUserId ?? '')).map((t) => ({
        id: t.id,
        supporterName: t.isAnonymous ? 'Anonymous' : t.toPlain().publicContentStatus === 'approved' ? t.supporterName || 'Someone' : 'Supporter',
        amount: t.amount,
        message: t.toPlain().publicContentStatus === 'approved' ? t.message : undefined,
      })),
    };
  }
}
