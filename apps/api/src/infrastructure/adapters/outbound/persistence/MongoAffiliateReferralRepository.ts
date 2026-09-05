import type { AffiliateReferral } from '@ubuntu-fund/types';
import type { AffiliateReferralRepositoryPort } from '../../../../domain/ports/outbound/AffiliateReferralRepositoryPort.js';
import {
  AffiliateReferralModel,
  type AffiliateReferralDocument,
} from '../../../database/models/AffiliateReferralModel.js';

function toDomain(doc: AffiliateReferralDocument): AffiliateReferral {
  return {
    id: doc._id!.toString(),
    referrerId: doc.referrerId,
    refereeId: doc.refereeId,
    referralCode: doc.referralCode,
    status: doc.status,
    convertedAt: doc.convertedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoAffiliateReferralRepository
  implements AffiliateReferralRepositoryPort
{
  async create(referral: AffiliateReferral): Promise<AffiliateReferral> {
    const doc = await AffiliateReferralModel.create({
      referrerId: referral.referrerId,
      refereeId: referral.refereeId,
      referralCode: referral.referralCode,
      status: referral.status,
      convertedAt: referral.convertedAt,
    });
    return toDomain(doc);
  }

  async findByRefereeId(refereeId: string): Promise<AffiliateReferral | null> {
    const doc = await AffiliateReferralModel.findOne({ refereeId });
    return doc ? toDomain(doc) : null;
  }

  async findByReferrerId(referrerId: string): Promise<AffiliateReferral[]> {
    const docs = await AffiliateReferralModel.find({ referrerId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async countByReferrerId(referrerId: string): Promise<number> {
    return AffiliateReferralModel.countDocuments({ referrerId });
  }

  async markConverted(refereeId: string): Promise<AffiliateReferral | null> {
    // Guarded pending → converted: the filter matches only while still 'pending',
    // so exactly one caller wins — the exactly-once gate for one-time affiliate
    // commission accrual on the referee's first paid subscription.
    const doc = await AffiliateReferralModel.findOneAndUpdate(
      { refereeId, status: 'pending' },
      { $set: { status: 'converted', convertedAt: new Date() } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
