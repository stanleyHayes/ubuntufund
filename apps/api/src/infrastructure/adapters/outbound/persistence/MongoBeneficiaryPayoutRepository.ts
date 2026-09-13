import { BeneficiaryPayoutEntity } from '../../../../domain/entities/BeneficiaryPayout.js';
import type { BeneficiaryPayoutRepositoryPort } from '../../../../domain/ports/outbound/BeneficiaryPayoutRepositoryPort.js';
import type { PayoutStatus } from '@ubuntu-fund/types';
import {
  BeneficiaryPayoutModel,
  type BeneficiaryPayoutDocument,
} from '../../../database/models/BeneficiaryPayoutModel.js';

function toDomain(doc: BeneficiaryPayoutDocument): BeneficiaryPayoutEntity {
  return new BeneficiaryPayoutEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    beneficiaryId: doc.beneficiaryId,
    recipientId: doc.recipientId,
    amount: doc.amount,
    currency: doc.currency,
    status: doc.status,
    provider: doc.provider,
    providerRef: doc.providerRef,
    transferCode: doc.transferCode,
    requestedBy: doc.requestedBy,
    approvedBy: doc.approvedBy,
    firstApprovedBy: doc.firstApprovedBy,
    firstApprovedAt: doc.firstApprovedAt,
    firstApprovalFingerprint: doc.firstApprovalFingerprint,
    reversedFrom: doc.reversedFrom,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

/** Compare the exact request and review read by the approver, including legacy absence. */
function approvalFilter(expected: BeneficiaryPayoutEntity) {
  const p = expected.toPlain();
  return { campaignId: p.campaignId, beneficiaryId: p.beneficiaryId, recipientId: p.recipientId,
    amount: p.amount, currency: p.currency,
    firstApprovedBy: p.firstApprovedBy ?? { $exists: false },
    firstApprovedAt: p.firstApprovedAt ?? { $exists: false },
    firstApprovalFingerprint: p.firstApprovalFingerprint ?? { $exists: false },
  };
}

export class MongoBeneficiaryPayoutRepository
  implements BeneficiaryPayoutRepositoryPort
{
  async create(
    payout: BeneficiaryPayoutEntity
  ): Promise<BeneficiaryPayoutEntity> {
    const p = payout.toPlain();
    const doc = await BeneficiaryPayoutModel.create({
      campaignId: p.campaignId,
      beneficiaryId: p.beneficiaryId,
      recipientId: p.recipientId,
      amount: p.amount,
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

  async findById(id: string): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByProviderRef(
    providerRef: string
  ): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findOne({ providerRef });
    return doc ? toDomain(doc) : null;
  }

  async findByCampaign(campaignId: string): Promise<BeneficiaryPayoutEntity[]> {
    const docs = await BeneficiaryPayoutModel.find({ campaignId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findAll(): Promise<BeneficiaryPayoutEntity[]> {
    const docs = await BeneficiaryPayoutModel.find().sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async findByStatuses(
    statuses: PayoutStatus[]
  ): Promise<BeneficiaryPayoutEntity[]> {
    const docs = await BeneficiaryPayoutModel.find({
      status: { $in: statuses },
    }).sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async findByCampaignAndBeneficiary(
    campaignId: string,
    beneficiaryId: string
  ): Promise<BeneficiaryPayoutEntity[]> {
    const docs = await BeneficiaryPayoutModel.find({
      campaignId,
      beneficiaryId,
    }).sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async recordFirstApproval(
    id: string,
    makerId: string,
    fingerprint: string,
    expected: BeneficiaryPayoutEntity
  ): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findOneAndUpdate(
      { _id: id, status: 'PENDING', ...approvalFilter(expected) },
      { $set: { firstApprovedBy: makerId, firstApprovedAt: new Date(), firstApprovalFingerprint: fingerprint } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async findStuckProcessing(olderThan: Date): Promise<BeneficiaryPayoutEntity[]> {
    const docs = await BeneficiaryPayoutModel.find({
      status: 'PROCESSING',
      providerRef: { $exists: true },
      updatedAt: { $lt: olderThan },
    }).sort({ updatedAt: 1 });
    return docs.map(toDomain);
  }

  async lockForSettlement(id: string): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findOneAndUpdate(
      { _id: id, settlementApplied: false, status: { $in: ['PAID', 'FAILED', 'REVERSED'] } },
      { $inc: { settlementWriteVersion: 1 } }, { new: true, timestamps: false }
    );
    return doc ? toDomain(doc) : null;
  }

  async markSettlementApplied(
    id: string,
    expectedStatus?: PayoutStatus
  ): Promise<void> {
    // Compare-and-set on status (G7) — see PayoutRepositoryPort.
    await BeneficiaryPayoutModel.updateOne(
      { _id: id, ...(expectedStatus ? { status: expectedStatus } : {}) },
      { $set: { settlementApplied: true } }
    );
  }

  async findTerminalUnsettled(
    olderThan: Date
  ): Promise<BeneficiaryPayoutEntity[]> {
    const docs = await BeneficiaryPayoutModel.find({
      // Exact `false`, not `$ne: true`: legacy payouts predate the field.
      settlementApplied: false,
      updatedAt: { $lt: olderThan },
      // REVERSED repairable only when reversedFrom is recorded (G7-era).
      $or: [
        { status: { $in: ['PAID', 'FAILED'] } },
        { status: 'REVERSED', reversedFrom: { $exists: true } },
      ],
    }).sort({ updatedAt: 1 });
    return docs.map(toDomain);
  }

  async transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string },
    expected: BeneficiaryPayoutEntity
  ): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findOneAndUpdate(
      { _id: id, status: 'PENDING', ...approvalFilter(expected) },
      {
        $set: {
          status: 'PROCESSING',
          approvedBy: fields.approvedBy,
          providerRef: fields.providerRef,
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async attachTransferCode(
    id: string,
    transferCode: string
  ): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findByIdAndUpdate(
      id,
      { $set: { transferCode } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  private async transition(
    id: string,
    from: string,
    to: string
  ): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findOneAndUpdate(
      { _id: id, status: from },
      { $set: { status: to } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  transitionToPaid(id: string): Promise<BeneficiaryPayoutEntity | null> {
    return this.transition(id, 'PROCESSING', 'PAID');
  }
  transitionToFailed(id: string): Promise<BeneficiaryPayoutEntity | null> {
    return this.transition(id, 'PROCESSING', 'FAILED');
  }
  // Record reversedFrom + RESET settlementApplied: the reversal is a new owed
  // effect, repairable if a crash leaves it unapplied (G7).
  async transitionPaidToReversed(
    id: string
  ): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findOneAndUpdate(
      { _id: id, status: 'PAID' },
      { $set: { status: 'REVERSED', reversedFrom: 'PAID', settlementApplied: false } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
  async transitionProcessingToReversed(
    id: string
  ): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findOneAndUpdate(
      { _id: id, status: 'PROCESSING' },
      { $set: { status: 'REVERSED', reversedFrom: 'PROCESSING', settlementApplied: false } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
