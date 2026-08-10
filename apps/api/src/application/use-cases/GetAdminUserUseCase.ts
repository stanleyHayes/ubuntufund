import type {
  AdminUserRecord,
  AdminUserRepositoryPort,
} from '../../domain/ports/outbound/AdminUserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class GetAdminUserUseCase {
  constructor(private readonly adminUserRepo: AdminUserRepositoryPort) {}

  async execute(id: string): Promise<AdminUserRecord> {
    const user = await this.adminUserRepo.findUserById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }
}
