import type { UserRole, VerificationLevel } from '@ubuntu-fund/types';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { ProfileRepositoryPort } from '../../domain/ports/outbound/ProfileRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface PublicUserProfileDTO {
  id: string;
  name: string;
  avatarUrl?: string;
  country?: string;
  trustScore: number;
  verificationLevel: VerificationLevel;
  role: UserRole;
  createdAt: Date;
}

export class GetPublicUserProfileUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly profileRepo: ProfileRepositoryPort
  ) {}

  async execute(userId: string): Promise<PublicUserProfileDTO> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const profile = await this.profileRepo.findByUserId(userId);
    if (profile && !profile.publicProfile) {
      throw new AppError('This profile is private', 403);
    }

    const plain = user.toPlain();

    return {
      id: plain.id,
      name: plain.name,
      avatarUrl: plain.avatarUrl,
      country: plain.country,
      trustScore: plain.trustScore.value,
      verificationLevel: plain.verificationLevel,
      role: plain.role,
      createdAt: plain.createdAt,
    };
  }
}
