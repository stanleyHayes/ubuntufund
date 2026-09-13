import type { MfaPort } from '../../domain/ports/outbound/MfaPort.js';
import { KYCStatus, KYCLevel, type LoginInput, type AuthTokens, type User } from '@ubuntu-fund/types';
import * as bcrypt from 'bcryptjs';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';

export class LoginUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly tokenService: AuthTokenService,
    private readonly mfa: MfaPort
  ) {}

  async execute(
    input: LoginInput
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    await this.mfa.verifyLogin(user.id, user.authVersion, input.mfaCode);

    const tokens = this.tokenService.generateTokens({
      userId: user.id,
      role: user.role,
      authVersion: user.authVersion,
    });

    return {
      user: {
        id: user.id,
        email: user.email.value,
        name: user.name,
        organizationName: user.organizationName,
        needsWebsite: user.needsWebsite,
        legalAcceptance: user.legalAcceptance,
        avatarUrl: user.avatarUrl,
        role: user.role,
        verificationLevel: user.verificationLevel,
        kycStatus: KYCStatus.UNVERIFIED,
        kycLevel: KYCLevel.NONE,
        trustScore: user.trustScore.value,
        country: user.country,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }
}
