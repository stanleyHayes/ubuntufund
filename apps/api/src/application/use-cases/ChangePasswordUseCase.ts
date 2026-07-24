import * as bcrypt from 'bcryptjs';
import type { AuthTokens } from '@ubuntu-fund/types';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly tokenService: AuthTokenService
  ) {}

  async execute(input: ChangePasswordInput, userId: string): Promise<AuthTokens> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError('Current password is incorrect', 400);
    }

    user.changePassword(await bcrypt.hash(input.newPassword, 12));
    await this.userRepo.update(user);

    // Kick out every existing session, then hand back a fresh pair that
    // outlives the revocation cutoff.
    return this.tokenService.rotateAllTokens({ userId: user.id, role: user.role });
  }
}
