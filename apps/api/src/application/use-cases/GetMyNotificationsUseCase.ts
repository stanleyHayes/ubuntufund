import type { NotificationRepositoryPort } from '../../domain/ports/outbound/NotificationRepositoryPort.js';
import type { NotificationEntity } from '../../domain/entities/Notification.js';

export interface NotificationDTO {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: Date;
}

export function toNotificationDTO(entity: NotificationEntity): NotificationDTO {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    title: plain.title,
    message: plain.body,
    type: plain.type,
    read: plain.read,
    createdAt: plain.createdAt,
  };
}

export class GetMyNotificationsUseCase {
  constructor(private readonly notificationRepo: NotificationRepositoryPort) {}

  async execute(userId: string): Promise<NotificationDTO[]> {
    const entities = await this.notificationRepo.findByUserId(userId);
    return entities.map(toNotificationDTO);
  }
}
