import type { NotificationRepositoryPort } from '../../domain/ports/outbound/NotificationRepositoryPort.js';

export class GetUnreadNotificationCountUseCase {
  constructor(private readonly notificationRepo: NotificationRepositoryPort) {}

  async execute(userId: string): Promise<number> {
    return this.notificationRepo.countUnreadByUserId(userId);
  }
}
