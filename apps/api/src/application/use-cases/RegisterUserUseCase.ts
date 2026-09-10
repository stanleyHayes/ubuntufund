import {
  type CreateUserInput,
  type AuthTokens,
  type User,
  UserRole,
  VerificationLevel,
  WalletType,
  KYCStatus,
  KYCLevel,
  AffiliateStatus,
} from '@ubuntu-fund/types';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../../domain/entities/User.js';
import { WalletEntity } from '../../domain/entities/Wallet.js';
import { Email } from '../../domain/value-objects/Email.js';
import { TrustScore } from '../../domain/value-objects/TrustScore.js';
import { Money } from '../../domain/value-objects/Money.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { WalletRepositoryPort } from '../../domain/ports/outbound/WalletRepositoryPort.js';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateReferralRepositoryPort } from '../../domain/ports/outbound/AffiliateReferralRepositoryPort.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly walletRepo: WalletRepositoryPort,
    private readonly tokenService: AuthTokenService,
    // Optional: when wired, a `?ref=` referral code on signup links the new user
    // to the referrer's affiliate. Absent, referral capture is simply skipped.
    private readonly affiliateRepo?: AffiliateRepositoryPort,
    private readonly affiliateReferralRepo?: AffiliateReferralRepositoryPort
  ) {}

  async execute(
    input: CreateUserInput
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const now = new Date();

    const user = new UserEntity({
      id: '', // Assigned by repository
      email: new Email(input.email),
      name: input.name,
      passwordHash,
      role:
        input.role === UserRole.ORGANIZATION
          ? UserRole.ORGANIZATION
          : UserRole.USER,
      verificationLevel: VerificationLevel.NONE,
      trustScore: TrustScore.default(),
      country: input.country,
      organizationName: input.organizationName,
      organizationType: input.organizationType,
      registrationNumber: input.registrationNumber,
      website: input.website,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    const savedUser = await this.userRepo.save(user);

    // Create default local wallet
    const wallet = new WalletEntity({
      id: '',
      userId: savedUser.id,
      type: WalletType.LOCAL,
      balance: new Money(0, 'GHS'),
      createdAt: now,
      updatedAt: now,
    });

    await this.walletRepo.save(wallet);

    // Capture an affiliate referral from a `?ref=` code, best-effort: a bad,
    // self-, or suspended-affiliate code (or a duplicate referral) must never
    // block signup, so any failure here is swallowed and logged.
    if (
      input.referralCode &&
      this.affiliateRepo &&
      this.affiliateReferralRepo
    ) {
      try {
        const affiliate = await this.affiliateRepo.findByReferralCode(
          input.referralCode
        );
        if (
          affiliate &&
          affiliate.userId !== savedUser.id && // no self-referral
          affiliate.status !== AffiliateStatus.SUSPENDED // suspended affiliates earn nothing
        ) {
          await this.affiliateReferralRepo.create({
            id: '', // assigned by the repository
            referrerId: affiliate.id,
            refereeId: savedUser.id, // unique: a user is referred at most once
            referralCode: affiliate.referralCode,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          });
        }
      } catch (err) {
        logger.warn(
          { err, referralCode: input.referralCode, userId: savedUser.id },
          'failed to capture affiliate referral at signup'
        );
      }
    }

    const tokens = this.tokenService.generateTokens({
      userId: savedUser.id,
      role: savedUser.role,
    });

    return {
      user: {
        id: savedUser.id,
        email: savedUser.email.value,
        name: savedUser.name,
        organizationName: savedUser.organizationName,
        avatarUrl: savedUser.avatarUrl,
        role: savedUser.role,
        verificationLevel: savedUser.verificationLevel,
        kycStatus: KYCStatus.UNVERIFIED,
        kycLevel: KYCLevel.NONE,
        trustScore: savedUser.trustScore.value,
        country: savedUser.country,
        createdAt: savedUser.createdAt,
        updatedAt: savedUser.updatedAt,
      },
      tokens,
    };
  }
}
