import { createHash } from 'crypto';
import { setTimeout as delay } from 'node:timers/promises';
import * as bcrypt from 'bcryptjs';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { PasswordResetTokenModel } from '../../infrastructure/database/models/PasswordResetTokenModel.js';
import type { AccountEmails } from '../../infrastructure/adapters/outbound/AccountEmails.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { MongoUnitOfWork } from '../../infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class ForgotPasswordUseCase {
  constructor(private readonly userRepo: UserRepositoryPort, private readonly emails: Pick<AccountEmails, 'configured' | 'enqueue'>) {}

  /** Always resolves without revealing whether the email exists. */
  async execute(email: string): Promise<void> {
    if (!this.emails.configured) throw new AppError('Password recovery is temporarily unavailable. Please try again later or contact support.', 503);
    // No provider network call runs on this path. Pad short database paths so an
    // unknown address does not return immediately while a known address queues.
    const started = Date.now();
    try {
      const user = await this.userRepo.findByEmail(email);
      if (user) await this.emails.enqueue(user);
    } finally { await delay(Math.max(0, 500 - (Date.now() - started))); }
  }
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly emails?: AccountEmails
  ) {}

  async execute(token: string, newPassword: string): Promise<void> {
    await new MongoUnitOfWork().run(async () => {
      const record = await PasswordResetTokenModel.findOne({
        tokenHash: hashToken(token),
        usedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      });
      if (!record) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      const user = await this.userRepo.findById(record.userId);
      if (!user || (record.authVersion ?? '') !== user.authVersion) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      user.changePassword(await bcrypt.hash(newPassword, 12));
      await this.userRepo.update(user);

      record.usedAt = new Date();
      await record.save();
      await this.emails?.enqueuePasswordChanged(user);

      // The password and credential version commit with token consumption. Old
      // sessions are rejected on every API instance, including after a restart.
    });
  }
}
