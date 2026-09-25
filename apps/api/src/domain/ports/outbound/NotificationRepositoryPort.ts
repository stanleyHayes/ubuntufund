import type { NotificationEntity } from '../../entities/Notification.js';

export interface NotificationRepositoryPort {
  save(notification: NotificationEntity): Promise<NotificationEntity>;
  findById(id: string): Promise<NotificationEntity | null>;
  /** Newest first, at most `limit`, optionally only those created before `before`. */
  findByUserId(userId: string, window: { limit: number; before?: Date }): Promise<NotificationEntity[]>;
  update(notification: NotificationEntity): Promise<NotificationEntity>;
  markAllAsRead(userId: string): Promise<number>;
  countUnreadByUserId(userId: string): Promise<number>;
}
