import { PayoutEntity } from '../../../../domain/entities/Payout.js';
import type { PayoutRepositoryPort } from '../../../../domain/ports/outbound/PayoutRepositoryPort.js';
import type { PayoutLeg, PayoutLegStatus, PayoutStatus } from '@ubuntu-fund/types';
import {
  PayoutModel,
  type PayoutDocument,
} from '../../../database/models/PayoutModel.js';

function toDomain(doc: PayoutDocument): PayoutEntity {
  return new PayoutEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    recipientId: doc.recipientId,
    amount: doc.amount,
    type: doc.type ?? 'standard',
    fee: doc.fee ?? 0,
    netAmount: doc.netAmount ?? doc.amount,
    currency: doc.currency,
    status: doc.status,
    provider: doc.provider,
    providerRef: doc.providerRef,
    transferCode: doc.transferCode,
    requestedBy: doc.requestedBy,
    approvedBy: doc.approvedBy,
    firstApprovedBy: doc.firstApprovedBy,
    firstApprovedAt: doc.firstApprovedAt,
    legs: doc.legs?.map((l) => ({
      index: l.index,
      amount: l.amount,
      reference: l.reference,
      transferCode: l.transferCode,
      status: l.status,
    })),
    reversedFrom: doc.reversedFrom,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoPayoutRepository implements PayoutRepositoryPort {
  async create(payout: PayoutEntity): Promise<PayoutEntity> {
    const p = payout.toPlain();
    const doc = await PayoutModel.create({
      campaignId: p.campaignId,
      recipientId: p.recipientId,
      amount: p.amount,
      type: p.type,
      fee: p.fee,
      netAmount: p.netAmount,
      currency: p.currency,
      status: p.status,
      provider: p.provider,
      providerRef: p.providerRef,
      transferCode: p.transferCode,
      requestedBy: p.requestedBy,
      approvedBy: p.approvedBy,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignId(campaignId: string): Promise<PayoutEntity[]> {
    const docs = await PayoutModel.find({ campaignId }).sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async findByProviderRef(providerRef: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOne({ providerRef });
    return doc ? toDomain(doc) : null;
  }

  async findByLegReference(reference: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOne({ 'legs.reference': reference });
    return doc ? toDomain(doc) : null;
  }

  async findAll(): Promise<PayoutEntity[]> {
    const docs = await PayoutModel.find().sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async findByStatuses(statuses: PayoutStatus[]): Promise<PayoutEntity[]> {
    const docs = await PayoutModel.find({ status: { $in: statuses } }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findStuckProcessing(olderThan: Date): Promise<PayoutEntity[]> {
    const docs = await PayoutModel.find({
      status: 'PROCESSING',
      providerRef: { $exists: true },
      legs: { $exists: false }, // single-transfer only; batched reconciled per-leg
      updatedAt: { $lt: olderThan },
    }).sort({ updatedAt: 1 });
    return docs.map(toDomain);
  }

  async findStuckBatchedProcessing(olderThan: Date): Promise<PayoutEntity[]> {
    const docs = await PayoutModel.find({
      status: 'PROCESSING',
      legs: { $exists: true, $ne: [] },
      updatedAt: { $lt: olderThan },
    }).sort({ updatedAt: 1 });
    return docs.map(toDomain);
  }

  async markSettlementApplied(
    id: string,
    expectedStatus?: PayoutStatus
  ): Promise<void> {
    // Compare-and-set on status: a repair that ran the effect for one status must
    // NOT flag a payout that has since transitioned (e.g. a stale PAID repair
    // racing a reversal), or the newly-owed effect would be lost and never
    // re-selected. Omitting expectedStatus keeps the old unconditional behaviour.
    await PayoutModel.updateOne(
      { _id: id, ...(expectedStatus ? { status: expectedStatus } : {}) },
      { $set: { settlementApplied: true } }
    );
  }

  async findTerminalUnsettled(olderThan: Date): Promise<PayoutEntity[]> {
    const docs = await PayoutModel.find({
      legs: { $exists: false }, // single-transfer only
      // Exact `false`, not `$ne: true`: legacy payouts predate the field (absent)
      // and were already settled by the old code — never repaired.
      settlementApplied: false,
      updatedAt: { $lt: olderThan },
      // REVERSED is repairable ONLY when reversedFrom is recorded (a G7-era
      // reversal). A pre-G7 REVERSED payout has no reversedFrom and cannot be
      // safely repaired, so it is excluded rather than re-scanned forever.
      $or: [
        { status: { $in: ['PAID', 'FAILED'] } },
        { status: 'REVERSED', reversedFrom: { $exists: true } },
      ],
    }).sort({ updatedAt: 1 });
    return docs.map(toDomain);
  }

  async recordFirstApproval(
    id: string,
    makerId: string
  ): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PENDING', firstApprovedBy: { $exists: false } },
      { $set: { firstApprovedBy: makerId, firstApprovedAt: new Date() } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToProcessingBatched(
    id: string,
    fields: { approvedBy: string; providerRef: string; legs: PayoutLeg[] }
  ): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      {
        $set: {
          status: 'PROCESSING',
          approvedBy: fields.approvedBy,
          providerRef: fields.providerRef,
          legs: fields.legs,
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async setLegStatus(
    id: string,
    reference: string,
    from: PayoutLegStatus[],
    to: PayoutLegStatus,
    extra?: { transferCode?: string }
  ): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      {
        _id: id,
        legs: { $elemMatch: { reference, status: { $in: from } } },
      },
      {
        $set: {
          'legs.$[leg].status': to,
          ...(extra?.transferCode
            ? { 'legs.$[leg].transferCode': extra.transferCode }
            : {}),
        },
      },
      {
        new: true,
        arrayFilters: [{ 'leg.reference': reference, 'leg.status': { $in: from } }],
      }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionBatchedToPaid(id: string): Promise<PayoutEntity | null> {
    // PROCESSING → PAID only when no leg is in a non-success state.
    const doc = await PayoutModel.findOneAndUpdate(
      {
        _id: id,
        status: 'PROCESSING',
        legs: { $not: { $elemMatch: { status: { $ne: 'success' } } } },
      },
      { $set: { status: 'PAID' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async flagNeedsReview(id: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: { $in: ['PROCESSING', 'PAID'] } },
      { $set: { status: 'NEEDS_REVIEW' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string; transferCode?: string }
  ): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
      {
        $set: {
          status: 'PROCESSING',
          approvedBy: fields.approvedBy,
          providerRef: fields.providerRef,
          ...(fields.transferCode ? { transferCode: fields.transferCode } : {}),
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async attachTransferCode(
    id: string,
    transferCode: string
  ): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findByIdAndUpdate(
      id,
      { $set: { transferCode } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToPaid(id: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'PAID' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionToFailed(id: string): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'FAILED' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionPaidToReversed(id: string): Promise<PayoutEntity | null> {
    // Record the source status and RESET settlementApplied: the payout now owes a
    // NEW (reverse) effect, so a crash before it lands is repairable (G7).
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PAID' },
      { $set: { status: 'REVERSED', reversedFrom: 'PAID', settlementApplied: false } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async transitionProcessingToReversed(
    id: string
  ): Promise<PayoutEntity | null> {
    const doc = await PayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'REVERSED', reversedFrom: 'PROCESSING', settlementApplied: false } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
