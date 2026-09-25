import type { KYCRepositoryPort } from '../../domain/ports/outbound/KYCRepositoryPort.js';
import { currentVerificationLevel } from '../../domain/services/currentVerificationLevel.js';
import type { VerificationLevel } from '@ubuntu-fund/types';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface PublicUserProfileDTO {
  id: string;
  name: string;
  avatarUrl?: string;
  country?: string;
  trustScore: number;
  verificationLevel: VerificationLevel;
  // No role: a public profile must not reveal which accounts are staff.
  createdAt: Date;
}

export class GetPublicUserProfileUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly visibility: PublicProfileVisibilityPort,
    private readonly kycRepo: KYCRepositoryPort
  ) {}

  async execute(userId: string, viewerId?: string): Promise<PublicUserProfileDTO> {
    if (!/^[a-f0-9]{24}$/i.test(userId) ||
        (await this.visibility.hiddenUserIds([userId], viewerId)).has(userId)) {
      throw new AppError('User not found', 404);
    }
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const plain = user.toPlain();

    return {
      id: plain.id,
      name: plain.name,
      avatarUrl: plain.avatarUrl,
      country: plain.country,
      trustScore: plain.trustScore.value,
      verificationLevel: currentVerificationLevel(user, await this.kycRepo.findByUserId(userId)),
      createdAt: plain.createdAt,
    };
  }
}
