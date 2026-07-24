import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';
import { PasswordResetTokenModel } from '../../infrastructure/database/models/PasswordResetTokenModel.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class ForgotPasswordUseCase {
  constructor(private readonly userRepo: UserRepositoryPort) {}

  /** Always resolves without revealing whether the email exists. */
  async execute(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return;

    const token = randomBytes(32).toString('hex');
    await PasswordResetTokenModel.create({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    // Email delivery is not wired yet (no provider credentials); surface the
    // link through the server log so operators can hand it to the user.
    logger.info(
      { userId: user.id, resetUrl: `/reset-password?token=${token}` },
      'password reset requested'
    );
  }
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly tokenService: AuthTokenService
  ) {}

  async execute(token: string, newPassword: string): Promise<void> {
    const record = await PasswordResetTokenModel.findOne({
      tokenHash: hashToken(token),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
    if (!record) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const user = await this.userRepo.findById(record.userId);
    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    user.changePassword(await bcrypt.hash(newPassword, 12));
    await this.userRepo.update(user);

    record.usedAt = new Date();
    await record.save();

    this.tokenService.revokeAllTokens(user.id);
  }
}
