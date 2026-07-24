import { NotificationEntity } from '../../../../domain/entities/Notification.js';
import type { NotificationRepositoryPort } from '../../../../domain/ports/outbound/NotificationRepositoryPort.js';
import {
  NotificationModel,
  type NotificationDocument,
} from '../../../database/models/NotificationModel.js';

function toDomain(doc: NotificationDocument): NotificationEntity {
  return new NotificationEntity({
    id: doc._id!.toString(),
    userId: doc.userId,
    title: doc.title,
    body: doc.body,
    type: doc.type,
    read: doc.read,
    createdAt: doc.createdAt,
  });
}

export class MongoNotificationRepository implements NotificationRepositoryPort {
  async save(notification: NotificationEntity): Promise<NotificationEntity> {
    const plain = notification.toPlain();
    const doc = await NotificationModel.create({
      userId: plain.userId,
      title: plain.title,
      body: plain.body,
      type: plain.type,
      read: plain.read,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    const doc = await NotificationModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByUserId(userId: string): Promise<NotificationEntity[]> {
    const docs = await NotificationModel.find({ userId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async update(notification: NotificationEntity): Promise<NotificationEntity> {
    const plain = notification.toPlain();
    const doc = await NotificationModel.findByIdAndUpdate(
      plain.id,
      { read: plain.read },
      { new: true }
    );
    if (!doc) {
      throw new Error('Notification not found');
    }
    return toDomain(doc);
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );
    return result.modifiedCount ?? 0;
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return NotificationModel.countDocuments({ userId, read: false });
  }
}
