import type { NotificationRepositoryPort } from '../../domain/ports/outbound/NotificationRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import {
  toNotificationDTO,
  type NotificationDTO,
} from './GetMyNotificationsUseCase.js';

export class MarkNotificationAsReadUseCase {
  constructor(private readonly notificationRepo: NotificationRepositoryPort) {}

  async execute(id: string, userId: string): Promise<NotificationDTO> {
    const notification = await this.notificationRepo.findById(id);
    if (!notification || notification.userId !== userId) {
      throw new AppError('Notification not found', 404);
    }

    notification.markAsRead();
    const updated = await this.notificationRepo.update(notification);

    return toNotificationDTO(updated);
  }
}
