import { DonationEntity } from '../../../../domain/entities/Donation.js';
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
    message: doc.message,
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
      currency: plain.amount.currency,
      message: plain.message,
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
