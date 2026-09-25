import type { NotificationRepositoryPort } from '../../domain/ports/outbound/NotificationRepositoryPort.js';
import type { NotificationEntity } from '../../domain/entities/Notification.js';

export interface NotificationDTO {
  id: string;
  title: string;
  message: string;
  path?: string;
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
    path: plain.path,
    type: plain.type,
    read: plain.read,
    createdAt: plain.createdAt,
  };
}

export class GetMyNotificationsUseCase {
  constructor(private readonly notificationRepo: NotificationRepositoryPort) {}

  /**
   * Newest first, bounded: the model has no TTL, so an unbounded read grew with
   * every notification a user ever received (and mobile polls it every 30 s).
   * Older pages: pass the last item's createdAt as `before`.
   */
  async execute(userId: string, window: { limit?: number; before?: Date } = {}): Promise<NotificationDTO[]> {
    const limit = Math.min(100, Math.max(1, Math.floor(window.limit ?? 50)));
    const entities = await this.notificationRepo.findByUserId(userId, { limit, before: window.before });
    return entities.map(toNotificationDTO);
  }
}
