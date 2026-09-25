import type { MfaPort } from '../../domain/ports/outbound/MfaPort.js';
import type { AuditLogRepositoryPort } from '../../domain/ports/outbound/AuditLogRepositoryPort.js';
import { KYCStatus, KYCLevel, type LoginInput, type AuthTokens, type User } from '@ubuntu-fund/types';
import * as bcrypt from 'bcryptjs';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';

export interface LoginRequest extends LoginInput {
  /** 'admin' when signing in to the staff console: only admin accounts receive tokens. */
  audience?: 'admin';
}

/** Where a sign-in came from, recorded on staff sign-in audit rows. */
export interface LoginContext {
  ip?: string;
  userAgent?: string;
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly tokenService: AuthTokenService,
    private readonly mfa: MfaPort,
    private readonly audit?: AuditLogRepositoryPort
  ) {}

  async execute(
    input: LoginRequest,
    context: LoginContext = {}
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }
    const isAdmin = user.role === 'admin';
    const record = (action: string, details: string, severity: 'info' | 'warning') =>
      this.audit?.record({
        actorId: user.id, actorRole: user.role, action, resource: 'account-security', details, severity,
        ip: context.ip, userAgent: context.userAgent?.slice(0, 300),
      });

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      if (isAdmin) await record('auth.admin_login.failed', 'Administrator sign-in failed: wrong password', 'warning');
      throw new AppError('Invalid email or password', 401);
    }

    try {
      await this.mfa.verifyLogin(user.id, user.authVersion, input.mfaCode);
    } catch (error) {
      // The first step of a two-step sign-in (no code yet) is not a failure.
      if (isAdmin && input.mfaCode) await record('auth.admin_login.failed', 'Administrator sign-in failed: authenticator code rejected', 'warning');
      throw error;
    }

    if (input.audience === 'admin' && !isAdmin) {
      // Refused before any token is issued, so a member account never holds a
      // staff-console session.
      await record('auth.admin_console.refused', 'Staff console sign-in refused: account is not an administrator', 'warning');
      throw new AppError('This account does not have staff access.', 403);
    }

    const tokens = this.tokenService.generateTokens({
      userId: user.id,
      role: user.role,
      authVersion: user.authVersion,
    });
    if (isAdmin) {
      await record('auth.admin_login.succeeded', `Administrator signed in${input.audience === 'admin' ? ' to the staff console' : ''}`, 'info');
    }

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
