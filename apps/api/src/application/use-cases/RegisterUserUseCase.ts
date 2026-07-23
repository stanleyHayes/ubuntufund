import {
  type CreateUserInput,
  type AuthTokens,
  type User,
  UserRole,
  VerificationLevel,
  WalletType,
} from '@ubuntu-fund/types';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../../domain/entities/User.js';
import { WalletEntity } from '../../domain/entities/Wallet.js';
import { Email } from '../../domain/value-objects/Email.js';
import { TrustScore } from '../../domain/value-objects/TrustScore.js';
import { Money } from '../../domain/value-objects/Money.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { WalletRepositoryPort } from '../../domain/ports/outbound/WalletRepositoryPort.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly walletRepo: WalletRepositoryPort,
    private readonly tokenService: AuthTokenService
  ) {}

  async execute(
    input: CreateUserInput
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const existingUser = await this.userRepo.findByEmail(input.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const now = new Date();

    const user = new UserEntity({
      id: '', // Assigned by repository
      email: new Email(input.email),
      name: input.name,
      passwordHash,
      role: UserRole.USER,
      verificationLevel: VerificationLevel.NONE,
      trustScore: TrustScore.default(),
      country: input.country,
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
      balance: new Money(0, 'ZAR'),
      createdAt: now,
      updatedAt: now,
    });

    await this.walletRepo.save(wallet);

    const tokens = this.tokenService.generateTokens({
      userId: savedUser.id,
      role: savedUser.role,
    });

    return {
      user: {
        id: savedUser.id,
        email: savedUser.email.value,
        name: savedUser.name,
        avatarUrl: savedUser.avatarUrl,
        role: savedUser.role,
        verificationLevel: savedUser.verificationLevel,
        trustScore: savedUser.trustScore.value,
        country: savedUser.country,
        createdAt: savedUser.createdAt,
        updatedAt: savedUser.updatedAt,
      },
      tokens,
    };
  }
}
