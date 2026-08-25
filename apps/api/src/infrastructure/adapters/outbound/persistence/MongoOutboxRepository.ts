import type { OutboxRecord } from '@ubuntu-fund/types';
import type {
  EnqueueOutboxInput,
  OutboxRepositoryPort,
} from '../../../../domain/ports/outbound/OutboxRepositoryPort.js';
import {
  OutboxModel,
  type OutboxDocument,
} from '../../../database/models/OutboxModel.js';

function toDomain(doc: OutboxDocument): OutboxRecord {
  return {
    id: doc._id!.toString(),
    type: doc.type,
    payload: doc.payload,
    status: doc.status,
    attempts: doc.attempts,
    createdAt: doc.createdAt,
    dispatchedAt: doc.dispatchedAt,
  };
}

export class MongoOutboxRepository implements OutboxRepositoryPort {
  async enqueue(input: EnqueueOutboxInput): Promise<OutboxRecord> {
    const doc = await OutboxModel.create({
      type: input.type,
      payload: input.payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    });
    return toDomain(doc);
  }

  async findPending(limit: number): Promise<OutboxRecord[]> {
    const docs = await OutboxModel.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  async markDispatched(id: string): Promise<void> {
    await OutboxModel.findByIdAndUpdate(id, {
      $set: { status: 'dispatched', dispatchedAt: new Date() },
    });
  }

  async recordAttempt(id: string): Promise<void> {
    await OutboxModel.findByIdAndUpdate(id, { $inc: { attempts: 1 } });
  }
}
