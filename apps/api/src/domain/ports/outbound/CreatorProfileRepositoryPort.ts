import type { CreatorProfileEntity } from '../../entities/CreatorProfile.js';

export interface CreatorProfileRepositoryPort {
  findByUserId(userId: string): Promise<CreatorProfileEntity | null>;
  /** Public lookup by the URL handle (case-insensitive). */
  findByHandle(handle: string): Promise<CreatorProfileEntity | null>;
  /**
   * Create or update the caller's profile (1:1 per userId). Throws a
   * duplicate-key error if the handle is already taken by another user.
   */
  save(
    userId: string,
    fields: {
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
  ): Promise<CreatorProfileEntity>;
}
