import type { CreatorProfileRepositoryPort } from '../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';
import { CreatorProfileEntity } from '../../domain/entities/CreatorProfile.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface SaveCreatorProfileInput {
  handle: string;
  displayName: string;
  tagline?: string;
  bio?: string;
  avatarUrl?: string;
  tipsEnabled?: boolean;
  presetAmounts?: number[];
  currency?: string;
  thankYouMessage?: string;
}

/**
 * Claim (or update) the caller's creator tip-jar profile. Validates the handle
 * shape + availability, upserts the 1:1 profile, and ensures a balance row so
 * the creator can start receiving tips immediately.
 */
export class SaveCreatorProfileUseCase {
  constructor(
    private readonly profileRepo: CreatorProfileRepositoryPort,
    private readonly balanceRepo: CreatorBalanceRepositoryPort
  ) {}

  async execute(userId: string, input: SaveCreatorProfileInput) {
    const handle = CreatorProfileEntity.normalizeHandle(input.handle);
    if (!CreatorProfileEntity.isValidHandle(handle)) {
      throw new AppError(
        'Handle must be 3–30 characters: letters, numbers, underscore or hyphen.',
        400
      );
    }
    if (!input.displayName || input.displayName.trim().length < 2) {
      throw new AppError('A display name is required.', 400);
    }

    // Guard the handle against another user before the write (the unique index
    // is the final arbiter, but this gives a clean 409 in the common case).
    const existing = await this.profileRepo.findByHandle(handle);
    if (existing && existing.userId !== userId) {
      throw new AppError('That handle is already taken.', 409);
    }

    const currency = input.currency || 'GHS';
    let profile: CreatorProfileEntity;
    try {
      profile = await this.profileRepo.save(userId, {
        handle,
        displayName: input.displayName.trim(),
        tagline: input.tagline,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        tipsEnabled: input.tipsEnabled ?? true,
        presetAmounts:
          input.presetAmounts && input.presetAmounts.length
            ? input.presetAmounts.filter((n) => n > 0).slice(0, 6)
            : undefined,
        currency,
        thankYouMessage: input.thankYouMessage,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new AppError('That handle is already taken.', 409);
      }
      throw err;
    }

    await this.balanceRepo.ensure(userId, currency);
    return profile.toPlain();
  }
}
