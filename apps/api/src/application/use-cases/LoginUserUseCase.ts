import type { LoginInput, AuthTokens, User } from '@ubuntu-fund/types';
import * as bcrypt from 'bcryptjs';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';

export class LoginUserUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly tokenService: AuthTokenService
  ) {}

  async execute(
    input: LoginInput
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash
    );
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const tokens = this.tokenService.generateTokens({
      userId: user.id,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email.value,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        verificationLevel: user.verificationLevel,
        trustScore: user.trustScore.value,
        country: user.country,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    };
  }
}
