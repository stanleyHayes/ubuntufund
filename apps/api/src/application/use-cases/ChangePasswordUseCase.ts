import * as bcrypt from 'bcryptjs';
import type { AuthTokens } from '@ubuntu-fund/types';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { AccountEmails } from '../../infrastructure/adapters/outbound/AccountEmails.js';
import { MongoUnitOfWork } from '../../infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly tokenService: AuthTokenService,
    private readonly emails?: AccountEmails
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
    await new MongoUnitOfWork().run(async () => {
      await this.userRepo.update(user);
      await this.emails?.enqueuePasswordChanged(user);
    });

    // The persisted credential version invalidates old sessions on every instance,
    // without relying on second-granularity token timestamps or a local cache.
    return this.tokenService.generateTokens({ userId: user.id, role: user.role, authVersion: user.authVersion });
  }
}
