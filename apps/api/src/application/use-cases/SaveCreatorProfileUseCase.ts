import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { CreatorProfileRepositoryPort } from '../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';
import type { PublicationAdmissionPort } from '../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js';
import { CreatorProfileEntity } from '../../domain/entities/CreatorProfile.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface SaveCreatorProfileInput {
  handle?: string;
  displayName?: string;
  tagline?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  tipsEnabled?: boolean;
  presetAmounts?: number[];
  currency?: string;
  thankYouMessage?: string;
  automatedReviewConsent?: boolean;
}

/** Complete proposed public versions are admitted before an atomic profile/balance save. */
export class SaveCreatorProfileUseCase {
  constructor(
    private readonly profileRepo: CreatorProfileRepositoryPort,
    private readonly balanceRepo: CreatorBalanceRepositoryPort,
    private readonly plans: PlanLimitsService,
    private readonly admission: PublicationAdmissionPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(userId: string, input: SaveCreatorProfileInput, authVersion = '') {
    const current = await this.profileRepo.findByUserId(userId);
    const previous = current?.toPlain();
    const normalize = (value: typeof previous) => ({
      handle: value?.handle ?? '', displayName: value?.displayName ?? '', tagline: value?.tagline ?? '', bio: value?.bio ?? '',
      avatarUrl: value?.avatarUrl ?? '', coverUrl: value?.coverUrl ?? '', tipsEnabled: value?.tipsEnabled ?? true,
      presetAmounts: value?.presetAmounts ?? [10, 25, 50, 100], currency: value?.currency ?? 'GHS', thankYouMessage: value?.thankYouMessage ?? '',
    });
    const before = normalize(previous);
    const fields = { ...before,
      handle: input.handle === undefined ? before.handle : CreatorProfileEntity.normalizeHandle(input.handle),
      displayName: input.displayName?.trim() ?? before.displayName,
      tagline: input.tagline ?? before.tagline, bio: input.bio ?? before.bio, avatarUrl: input.avatarUrl ?? before.avatarUrl, coverUrl: input.coverUrl ?? before.coverUrl,
      tipsEnabled: input.tipsEnabled ?? before.tipsEnabled, presetAmounts: input.presetAmounts ?? before.presetAmounts,
      currency: input.currency ?? before.currency, thankYouMessage: input.thankYouMessage ?? before.thankYouMessage,
    };
    const pauseOnly = !!current && input.tipsEnabled === false && JSON.stringify({ ...fields, tipsEnabled: before.tipsEnabled }) === JSON.stringify(before);
    const changedKeys = (Object.keys(fields) as (keyof typeof fields)[]).filter(key => JSON.stringify(fields[key]) !== JSON.stringify(before[key]));
    // Removing a creator photo publishes nothing new, so it applies at once.
    const withdrawalOnly = !!current && changedKeys.length > 0 && changedKeys.every(key => (key === 'avatarUrl' || key === 'coverUrl') && fields[key] === '');
    const publicChange = !current || (!pauseOnly && !withdrawalOnly && changedKeys.length > 0);
    if (!CreatorProfileEntity.isValidHandle(fields.handle) || fields.displayName.length < 2) throw new AppError('A valid handle and display name are required.', 400);
    if (!pauseOnly && !withdrawalOnly) {
      await this.plans.assertCreatorDonations(userId);
      if (fields.currency !== 'GHS') throw new AppError('Creator pages must use GHS.', 422);
      const existing = await this.profileRepo.findByHandle(fields.handle);
      if (existing && existing.userId !== userId) throw new AppError('That handle is already taken.', 409);
    }
    if (publicChange) {
      if (!this.admission) throw new AppError('Creator safety review is unavailable', 503);
      // Only newly proposed images need media inspection; unchanged ones are
      // already public. The complete page stays bound in the text.
      const newMedia = (['avatarUrl', 'coverUrl'] as const).filter(key => fields[key] && fields[key] !== before[key]).map(key => fields[key]);
      await this.admission.assertAllowed({ actorId: userId, action: 'creator.profile', resourceId: userId,
        baseVersion: current ? String(current.revision) : 'new', text: JSON.stringify(fields),
        mediaUrls: newMedia, automatedReviewConsent: input.automatedReviewConsent });
      await this.plans.assertCreatorDonations(userId);
    }
    if (!this.uow) throw new AppError('Creator profile persistence is unavailable', 503);
    try {
      return await this.uow.run(async () => {
        const profile = await this.profileRepo.save(userId, fields, { expectedRevision: current?.revision ?? null, authVersion, publicChange });
        await this.balanceRepo.ensure(userId, fields.currency);
        return profile.toPlain();
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new AppError('That handle was claimed or your page changed. Reload and review the current page.', 409);
      throw error;
    }
  }
}
