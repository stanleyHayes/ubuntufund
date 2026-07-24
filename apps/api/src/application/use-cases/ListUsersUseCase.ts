import type { PaginationParams, PaginatedResponse } from '@ubuntu-fund/types';
import type { AdminUserRepositoryPort } from '../../domain/ports/outbound/AdminUserRepositoryPort.js';
import type { AdminUserRecord } from '../../domain/ports/outbound/AdminUserRepositoryPort.js';

export class ListUsersUseCase {
  constructor(private readonly adminUserRepo: AdminUserRepositoryPort) {}

  async execute(
    params: PaginationParams
  ): Promise<PaginatedResponse<AdminUserRecord>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const { items, total } = await this.adminUserRepo.listUsers({
      ...params,
      page,
      pageSize,
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
