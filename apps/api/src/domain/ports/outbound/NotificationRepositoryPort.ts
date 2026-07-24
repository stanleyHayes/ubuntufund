import type { NotificationEntity } from '../../entities/Notification.js';

export interface NotificationRepositoryPort {
  save(notification: NotificationEntity): Promise<NotificationEntity>;
  findById(id: string): Promise<NotificationEntity | null>;
  findByUserId(userId: string): Promise<NotificationEntity[]>;
  update(notification: NotificationEntity): Promise<NotificationEntity>;
  markAllAsRead(userId: string): Promise<number>;
  countUnreadByUserId(userId: string): Promise<number>;
}
