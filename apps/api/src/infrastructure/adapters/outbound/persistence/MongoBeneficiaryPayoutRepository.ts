import { BeneficiaryPayoutEntity } from '../../../../domain/entities/BeneficiaryPayout.js';
import type { BeneficiaryPayoutRepositoryPort } from '../../../../domain/ports/outbound/BeneficiaryPayoutRepositoryPort.js';
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
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
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
    makerId: string
  ): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findOneAndUpdate(
      { _id: id, status: 'PENDING', firstApprovedBy: { $exists: false } },
      { $set: { firstApprovedBy: makerId, firstApprovedAt: new Date() } },
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

  async transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string }
  ): Promise<BeneficiaryPayoutEntity | null> {
    const doc = await BeneficiaryPayoutModel.findOneAndUpdate(
      { _id: id, status: 'PENDING' },
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
  transitionPaidToReversed(id: string): Promise<BeneficiaryPayoutEntity | null> {
    return this.transition(id, 'PAID', 'REVERSED');
  }
  transitionProcessingToReversed(
    id: string
  ): Promise<BeneficiaryPayoutEntity | null> {
    return this.transition(id, 'PROCESSING', 'REVERSED');
  }
}
