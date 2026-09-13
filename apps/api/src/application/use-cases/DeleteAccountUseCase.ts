import type { AccountErasurePort } from '../../domain/ports/outbound/AccountErasurePort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { AuthTokenService } from '../services/AuthTokenService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class DeleteAccountUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly tokenService: AuthTokenService,
    private readonly erasure?: AccountErasurePort
  ) {}

  async execute(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new AppError('Account not found', 404);

    if (this.erasure) await this.erasure.request(userId);
    else await this.userRepo.delete(userId);
    this.tokenService.revokeAllTokens(userId);
  }
}
