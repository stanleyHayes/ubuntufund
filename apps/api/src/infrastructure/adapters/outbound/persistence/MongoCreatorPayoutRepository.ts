import { CreatorPayoutEntity } from '../../../../domain/entities/CreatorPayout.js';
import type { CreatorPayoutRepositoryPort } from '../../../../domain/ports/outbound/CreatorPayoutRepositoryPort.js';
import type { PayoutStatus } from '@ubuntu-fund/types';
import {
  CreatorPayoutModel,
  type CreatorPayoutDocument,
} from '../../../database/models/CreatorPayoutModel.js';

function toDomain(doc: CreatorPayoutDocument): CreatorPayoutEntity {
  return new CreatorPayoutEntity({
    id: doc._id!.toString(),
    creatorUserId: doc.creatorUserId,
    amount: doc.amount,
    currency: doc.currency,
    status: doc.status,
    provider: doc.provider,
    providerRef: doc.providerRef,
    transferCode: doc.transferCode,
    recipientCode: doc.recipientCode,
    recipientName: doc.recipientName,
    settlementApplied: doc.settlementApplied,
    reversedFrom: doc.reversedFrom,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoCreatorPayoutRepository implements CreatorPayoutRepositoryPort {
  async create(payout: CreatorPayoutEntity): Promise<CreatorPayoutEntity> {
    const p = payout.toPlain();
    const doc = await CreatorPayoutModel.create({
      creatorUserId: p.creatorUserId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      provider: p.provider,
      recipientName: p.recipientName,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<CreatorPayoutEntity | null> {
    const doc = await CreatorPayoutModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByProviderRef(providerRef: string): Promise<CreatorPayoutEntity | null> {
    const doc = await CreatorPayoutModel.findOne({ providerRef });
    return doc ? toDomain(doc) : null;
  }

  async findByCreator(creatorUserId: string, limit = 20): Promise<CreatorPayoutEntity[]> {
    const docs = await CreatorPayoutModel.find({ creatorUserId })
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  async transitionToProcessing(
    id: string,
    fields: { providerRef: string; transferCode?: string; recipientCode?: string }
  ): Promise<CreatorPayoutEntity | null> {
    const doc = await CreatorPayoutModel.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      {
        $set: {
          status: 'PROCESSING',
          providerRef: fields.providerRef,
          ...(fields.transferCode ? { transferCode: fields.transferCode } : {}),
          ...(fields.recipientCode ? { recipientCode: fields.recipientCode } : {}),
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  private async transition(
    id: string,
    from: PayoutStatus,
    to: PayoutStatus,
    extra: Record<string, unknown> = {}
  ): Promise<CreatorPayoutEntity | null> {
    const doc = await CreatorPayoutModel.findOneAndUpdate(
      { _id: id, status: from },
      { $set: { status: to, ...extra } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  transitionToPaid(id: string) {
    return this.transition(id, 'PROCESSING', 'PAID');
  }
  transitionToFailed(id: string) {
    return this.transition(id, 'PROCESSING', 'FAILED');
  }
  transitionPaidToReversed(id: string) {
    return this.transition(id, 'PAID', 'REVERSED', { reversedFrom: 'PAID', settlementApplied: false });
  }
  transitionProcessingToReversed(id: string) {
    return this.transition(id, 'PROCESSING', 'REVERSED', { reversedFrom: 'PROCESSING', settlementApplied: false });
  }

  async markSettlementApplied(id: string, expectedStatus?: PayoutStatus): Promise<void> {
    await CreatorPayoutModel.updateOne(
      { _id: id, ...(expectedStatus ? { status: expectedStatus } : {}) },
      { $set: { settlementApplied: true } }
    );
  }

  async findStuckProcessing(olderThan: Date): Promise<CreatorPayoutEntity[]> {
    const docs = await CreatorPayoutModel.find({
      status: 'PROCESSING',
      providerRef: { $exists: true },
      updatedAt: { $lt: olderThan },
    }).sort({ updatedAt: 1 });
    return docs.map(toDomain);
  }

  async findTerminalUnsettled(olderThan: Date): Promise<CreatorPayoutEntity[]> {
    const docs = await CreatorPayoutModel.find({
      settlementApplied: false,
      updatedAt: { $lt: olderThan },
      $or: [
        { status: { $in: ['PAID', 'FAILED'] } },
        { status: 'REVERSED', reversedFrom: { $exists: true } },
      ],
    }).sort({ updatedAt: 1 });
    return docs.map(toDomain);
  }
}
