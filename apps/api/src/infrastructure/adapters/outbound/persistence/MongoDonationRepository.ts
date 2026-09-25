import { DonationEntity } from '../../../../domain/entities/Donation.js';
import { PaymentMethod, type LegalAcceptanceRecord } from '@ubuntu-fund/types';
import { Money } from '../../../../domain/value-objects/Money.js';
import type { DonationRepositoryPort } from '../../../../domain/ports/outbound/DonationRepositoryPort.js';
import {
  DonationModel,
  type DonationDocument,
} from '../../../database/models/DonationModel.js';

function toDomain(doc: DonationDocument): DonationEntity {
  return new DonationEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    donorId: doc.donorId,
    amount: new Money(doc.amount, doc.currency),
    tip: doc.tip,
    paymentMethod: doc.paymentMethod ?? PaymentMethod.WALLET,
    message: doc.message,
    donorName: doc.donorName,
    messageHiddenAt: doc.messageHiddenAt,
    publicContentStatus: doc.publicContentStatus,
    publicContentFingerprint: doc.publicContentFingerprint,
    publicContentRevokedAt: doc.publicContentRevokedAt,
    messageAgreement: doc.messageAgreement,
    isAnonymous: doc.isAnonymous,
    createdAt: doc.createdAt,
  });
}

export class MongoDonationRepository implements DonationRepositoryPort {
  async save(donation: DonationEntity): Promise<DonationEntity> {
    const plain = donation.toPlain();
    const doc = await DonationModel.create({
      campaignId: plain.campaignId,
      donorId: plain.donorId,
      amount: plain.amount.amount,
      ...(plain.tip && plain.tip > 0 ? { tip: plain.tip } : {}),
      currency: plain.amount.currency,
      paymentMethod: plain.paymentMethod,
      message: plain.message,
      donorName: plain.donorName,
      messageAgreement: plain.messageAgreement,
      isAnonymous: plain.isAnonymous,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<DonationEntity | null> {
    const doc = await DonationModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignId(campaignId: string): Promise<DonationEntity[]> {
    const docs = await DonationModel.find({ campaignId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findByDonorId(donorId: string): Promise<DonationEntity[]> {
    const docs = await DonationModel.find({ donorId }).sort({ createdAt: -1 });
    return docs.map(toDomain);
  }

  async findRecent(limit: number): Promise<DonationEntity[]> {
    const docs = await DonationModel.find()
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(toDomain);
  }

  async updateMessage(
    id: string,
    donorId: string,
    message: string,
    agreement: LegalAcceptanceRecord
  ): Promise<DonationEntity | null> {
    // Ownership is enforced in the filter: a non-owner matches nothing → null.
    const doc = await DonationModel.findOneAndUpdate(
      { _id: id, donorId, messageHiddenAt: { $exists: false }, publicContentRevokedAt: { $exists: false } },
      { $set: { message, messageAgreement: agreement, publicContentStatus: 'pending' }, $unset: { publicContentFingerprint: '', publicReviewedBy: '', publicReviewedAt: '', publicReviewNotes: '' } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async countDistinctDonorsByCampaignIds(campaignIds: string[]): Promise<Record<string, number>> {
    if (campaignIds.length === 0) return {};
    const rows = await DonationModel.aggregate<{ _id: string; donors: number }>([
      { $match: { campaignId: { $in: campaignIds } } },
      { $group: { _id: { campaignId: '$campaignId', donorId: '$donorId' } } },
      { $group: { _id: '$_id.campaignId', donors: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.donors]));
  }
}
