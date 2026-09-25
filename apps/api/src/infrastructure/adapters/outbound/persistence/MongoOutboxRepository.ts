import { randomUUID } from 'node:crypto';
import { isObjectIdOrHexString } from 'mongoose';
import type { OutboxRecord } from '@ubuntu-fund/types';
import type {
  ClaimedOutboxRecord,
  EnqueueOutboxInput,
  OutboxRepositoryPort,
} from '../../../../domain/ports/outbound/OutboxRepositoryPort.js';
import {
  OutboxModel,
  type OutboxDocument,
} from '../../../database/models/OutboxModel.js';

/** A pending row nobody holds an unexpired dispatch lease on. */
function claimableAt(now: Date) {
  return {
    status: 'pending' as const,
    $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }],
  };
}

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

  async claim(id: string, leaseMs: number): Promise<string | null> {
    if (!isObjectIdOrHexString(id)) return null;
    const now = new Date();
    const leaseToken = randomUUID();
    const doc = await OutboxModel.findOneAndUpdate(
      { _id: id, ...claimableAt(now) },
      { $set: { leaseToken, leaseUntil: new Date(now.getTime() + leaseMs) } }
    );
    return doc ? leaseToken : null;
  }

  async claimNextPending(createdBefore: Date, leaseMs: number, maxAttempts?: number): Promise<ClaimedOutboxRecord | null> {
    const now = new Date();
    const leaseToken = randomUUID();
    const doc = await OutboxModel.findOneAndUpdate(
      {
        createdAt: { $lte: createdBefore },
        ...claimableAt(now),
        // `$not` so a legacy row without an attempts field still qualifies.
        ...(maxAttempts ? { attempts: { $not: { $gte: maxAttempts } } } : {}),
      },
      { $set: { leaseToken, leaseUntil: new Date(now.getTime() + leaseMs) } },
      { new: true, sort: { createdAt: 1 } }
    );
    return doc ? { record: toDomain(doc), leaseToken } : null;
  }

  async markDispatched(id: string, leaseToken: string): Promise<void> {
    // Only the current lease holder settles the row.
    await OutboxModel.updateOne(
      { _id: id, leaseToken },
      {
        $set: { status: 'dispatched', dispatchedAt: new Date() },
        $unset: { leaseToken: 1, leaseUntil: 1 },
      }
    );
  }

  async recordAttempt(id: string): Promise<void> {
    await OutboxModel.findByIdAndUpdate(id, { $inc: { attempts: 1 } });
  }
}
