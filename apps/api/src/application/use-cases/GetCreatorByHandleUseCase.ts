import type { ProfileRepositoryPort } from '../../domain/ports/outbound/ProfileRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
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
    private readonly users?: UserRepositoryPort,
    private readonly userProfiles?: ProfileRepositoryPort
  ) {}

  async execute(handle: string) {
    const p = await this.profileRepo.findByHandle(handle);
    if (!p) throw new AppError('Creator not found', 404);
    const privacy = await this.userProfiles?.findByUserId(p.userId);
    const user = privacy?.publicProfile === false ? null : await this.users?.findById(p.userId);
    const policy = await this.plans.creatorPolicy(p.userId);
    const stats = await this.tipRepo.creatorStats(p.userId);
    const recent = await this.tipRepo.findByCreator(p.userId, 10);
    return {
      handle: p.handle,
      displayName: p.displayName,
      tagline: p.tagline,
      bio: p.bio,
      avatarUrl: p.avatarUrl || user?.avatarUrl,
      coverUrl: user?.toPlain().coverUrl,
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
