import { CampaignStatus, type PaginationParams } from '@ubuntu-fund/types';
import { CampaignEntity } from '../../../../domain/entities/Campaign.js';
import { Money } from '../../../../domain/value-objects/Money.js';
import type { CampaignRepositoryPort } from '../../../../domain/ports/outbound/CampaignRepositoryPort.js';
import {
  CampaignModel,
  type CampaignDocument,
} from '../../../database/models/CampaignModel.js';

function toDomain(doc: CampaignDocument): CampaignEntity {
  return new CampaignEntity({
    id: doc._id!.toString(),
    slug: doc.slug ?? '',
    title: doc.title,
    description: doc.description,
    goalAmount: new Money(doc.goalAmount, doc.currency),
    raisedAmount: new Money(doc.raisedAmount, doc.currency),
    category: doc.category,
    priority: doc.priority,
    status: doc.status,
    creatorId: doc.creatorId,
    beneficiaries: doc.beneficiaries,
    imageUrls: doc.imageUrls,
    startDate: doc.startDate,
    endDate: doc.endDate,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    tier: doc.tier,
    lockedPlatformFeePercent: doc.lockedPlatformFeePercent,
  });
}

export class MongoCampaignRepository implements CampaignRepositoryPort {
  async save(campaign: CampaignEntity): Promise<CampaignEntity> {
    const plain = campaign.toPlain();
    const doc = await CampaignModel.create({
      // Only persist a slug when one is set: a stored '' would collide with
      // other slug-less campaigns on the unique (sparse) index.
      ...(plain.slug ? { slug: plain.slug } : {}),
      title: plain.title,
      description: plain.description,
      goalAmount: plain.goalAmount.amount,
      raisedAmount: plain.raisedAmount.amount,
      currency: plain.goalAmount.currency,
      category: plain.category,
      priority: plain.priority,
      status: plain.status,
      creatorId: plain.creatorId,
      beneficiaries: plain.beneficiaries,
      imageUrls: plain.imageUrls,
      startDate: plain.startDate,
      endDate: plain.endDate,
      tier: plain.tier,
      lockedPlatformFeePercent: plain.lockedPlatformFeePercent,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<CampaignEntity | null> {
    const doc = await CampaignModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    return doc ? toDomain(doc) : null;
  }

  async findBySlug(slug: string): Promise<CampaignEntity | null> {
    const doc = await CampaignModel.findOne({
      slug: slug.toLowerCase(),
      deletedAt: { $exists: false },
    });
    return doc ? toDomain(doc) : null;
  }

  async findAll(
    params: PaginationParams
  ): Promise<{ items: CampaignEntity[]; total: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const sortField = params.sortBy ?? 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;

    const [docs, total] = await Promise.all([
      CampaignModel.find({ deletedAt: { $exists: false } })
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(pageSize),
      CampaignModel.countDocuments({ deletedAt: { $exists: false } }),
    ]);

    return {
      items: docs.map(toDomain),
      total,
    };
  }

  async findByCreatorId(creatorId: string): Promise<CampaignEntity[]> {
    const docs = await CampaignModel.find({
      creatorId,
      deletedAt: { $exists: false },
    });
    return docs.map(toDomain);
  }

  async update(campaign: CampaignEntity): Promise<CampaignEntity> {
    const plain = campaign.toPlain();
    const doc = await CampaignModel.findByIdAndUpdate(
      { _id: plain.id, deletedAt: { $exists: false } },
      {
        ...(plain.slug ? { slug: plain.slug } : {}),
        title: plain.title,
        description: plain.description,
        goalAmount: plain.goalAmount.amount,
        raisedAmount: plain.raisedAmount.amount,
        currency: plain.goalAmount.currency,
        category: plain.category,
        priority: plain.priority,
        status: plain.status,
        beneficiaries: plain.beneficiaries,
        imageUrls: plain.imageUrls,
        endDate: plain.endDate,
      },
      { new: true }
    );

    if (!doc) {
      throw new Error('Campaign not found');
    }
    return toDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await CampaignModel.updateOne(
      { _id: id, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } }
    );
  }

  async countByCreatorId(creatorId: string): Promise<number> {
    return CampaignModel.countDocuments({
      creatorId,
      deletedAt: { $exists: false },
    });
  }

  async countActiveByCreator(creatorId: string): Promise<number> {
    return CampaignModel.countDocuments({
      creatorId,
      deletedAt: { $exists: false },
      status: { $in: [CampaignStatus.ACTIVE, CampaignStatus.PENDING_REVIEW] },
    });
  }

  async incrementRaised(
    campaignId: string,
    amount: number,
    currency: string
  ): Promise<CampaignEntity | null> {
    // Called only from the post-settlement projection seam: by this point the
    // money has moved and the journal is posted, so the credit is not optional.
    // A `status: 'active'` + `endDate` guard here dropped the credit whenever a
    // campaign flipped to funded (or elapsed) between validation and settlement
    // — a concurrent donation that tipped the goal, say — leaving raisedAmount
    // permanently understated against the ledger. Eligibility is decided earlier
    // by `canReceiveDonation()`; this mirrors `reverseRaised` below, which omits
    // the same guards for the same reason.
    const doc = await CampaignModel.findOneAndUpdate(
      { _id: campaignId, deletedAt: { $exists: false }, currency },
      { $inc: { raisedAmount: amount } },
      { new: true }
    );
    if (!doc) return null;

    // Flip to funded once the goal is met; benign if two donations race.
    if (doc.raisedAmount >= doc.goalAmount && doc.status === 'active') {
      doc.status = 'funded' as typeof doc.status;
      await doc.save();
    }
    return toDomain(doc);
  }

  async reverseRaised(
    campaignId: string,
    amount: number,
    currency: string
  ): Promise<CampaignEntity | null> {
    // A refund reversal must reduce the raised total regardless of campaign
    // state (funded/ended included) — so, unlike incrementRaised, no active/
    // endDate guard. Scoped to the campaign + currency; never goes negative.
    const doc = await CampaignModel.findOneAndUpdate(
      { _id: campaignId, currency, deletedAt: { $exists: false } },
      { $inc: { raisedAmount: -Math.abs(amount) } },
      { new: true }
    );
    if (!doc) return null;
    if (doc.raisedAmount < 0) {
      doc.raisedAmount = 0;
      await doc.save();
    }
    return toDomain(doc);
  }
}
