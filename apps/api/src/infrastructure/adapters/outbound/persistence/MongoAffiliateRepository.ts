import { UserModel } from '../../../database/models/UserModel.js';
import type { Affiliate } from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../../../domain/ports/outbound/AffiliateRepositoryPort.js';
import {
  AffiliateModel,
  type AffiliateDocument,
} from '../../../database/models/AffiliateModel.js';

function toDomain(doc: AffiliateDocument): Affiliate {
  return {
    id: doc._id!.toString(),
    userId: doc.userId,
    referralCode: doc.referralCode,
    status: doc.status,
    commissionRate: doc.commissionRate,
    recipientCode: doc.recipientCode,
    recipientType: doc.recipientType,
    accountNumber: doc.accountNumber,
    bankCode: doc.bankCode,
    accountName: doc.accountName,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoAffiliateRepository implements AffiliateRepositoryPort {
  async create(affiliate: Affiliate): Promise<Affiliate> {
    const doc = await AffiliateModel.create({
      userId: affiliate.userId,
      referralCode: affiliate.referralCode,
      status: affiliate.status,
      commissionRate: affiliate.commissionRate,
      recipientCode: affiliate.recipientCode,
      recipientType: affiliate.recipientType,
      accountNumber: affiliate.accountNumber,
      bankCode: affiliate.bankCode,
      accountName: affiliate.accountName,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<Affiliate | null> {
    const doc = await AffiliateModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByUserId(userId: string): Promise<Affiliate | null> {
    const doc = await AffiliateModel.findOne({ userId });
    return doc ? toDomain(doc) : null;
  }

  async findByReferralCode(referralCode: string): Promise<Affiliate | null> {
    // Codes are stored lowercased; normalize the lookup so it's case-insensitive.
    const doc = await AffiliateModel.findOne({
      referralCode: referralCode.toLowerCase(),
    });
    return doc ? toDomain(doc) : null;
  }

  async referralCodeExists(referralCode: string): Promise<boolean> {
    const count = await AffiliateModel.countDocuments({
      referralCode: referralCode.toLowerCase(),
    });
    return count > 0;
  }

  async findAll(): Promise<Affiliate[]> {
    const docs = await AffiliateModel.find().sort({ createdAt: -1 });
    const users = await UserModel.find({
      _id: { $in: docs.map((doc) => doc.userId) },
      deletedAt: null,
    }).select('_id name').lean();
    const names = new Map(users.map((user) => [String(user._id), user.name]));
    return docs.map((doc) => ({ ...toDomain(doc), userName: names.get(doc.userId) }));
  }

  async update(affiliate: Affiliate): Promise<Affiliate | null> {
    // Replaces the mutable fields (status, commissionRate, payout recipient);
    // userId / referralCode are immutable identifiers and are never touched.
    const doc = await AffiliateModel.findByIdAndUpdate(
      affiliate.id,
      {
        $set: {
          status: affiliate.status,
          commissionRate: affiliate.commissionRate,
          recipientCode: affiliate.recipientCode,
          recipientType: affiliate.recipientType,
          accountNumber: affiliate.accountNumber,
          bankCode: affiliate.bankCode,
          accountName: affiliate.accountName,
        },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
