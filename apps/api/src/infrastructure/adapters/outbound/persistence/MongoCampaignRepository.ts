import { PUBLIC_CAMPAIGN_STATUSES } from '../../../../domain/services/campaignVisibility.js';
import { CampaignStatus } from '@ubuntu-fund/types';
import type { FilterQuery, SortOrder } from 'mongoose';
import { CampaignEntity } from '../../../../domain/entities/Campaign.js';
import { Money } from '../../../../domain/value-objects/Money.js';
import type {
  CampaignListQuery,
  CampaignListStatus,
  CampaignRepositoryPort,
} from '../../../../domain/ports/outbound/CampaignRepositoryPort.js';
import {
  CampaignModel,
  type CampaignDocument,
} from '../../../database/models/CampaignModel.js';

/** Statuses that still collect until their end date passes. */
const OPEN_STATUSES = [CampaignStatus.ACTIVE, CampaignStatus.FUNDED];

/**
 * Filter on a campaign's effective state. The expiry sweep re-labels ended
 * campaigns periodically, so between sweeps an ended campaign may still be
 * stored as ACTIVE/FUNDED: listings must not show it as open.
 */
function effectiveStatusFilter(status: CampaignListStatus, now: Date): FilterQuery<CampaignDocument> {
  switch (status) {
    case CampaignStatus.ACTIVE:
    case CampaignStatus.FUNDED:
      return { status, endDate: { $gt: now } };
    case 'open':
      return { status: { $in: OPEN_STATUSES }, endDate: { $gt: now } };
    case CampaignStatus.EXPIRED:
      return { $or: [{ status: CampaignStatus.EXPIRED }, { status: { $in: OPEN_STATUSES }, endDate: { $lte: now } }] };
    default:
      return { status };
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    reviewRevision: doc.reviewRevision,
  });
}

export class MongoCampaignRepository implements CampaignRepositoryPort {
  async save(campaign: CampaignEntity, options: { creationIdempotencyKey?: string } = {}): Promise<CampaignEntity> {
    const plain = campaign.toPlain();
    const doc = await CampaignModel.create({
      ...(options.creationIdempotencyKey ? { creationIdempotencyKey: options.creationIdempotencyKey } : {}),
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

  async findByCreationKey(creatorId: string, key: string): Promise<CampaignEntity | null> {
    const doc = await CampaignModel.findOne({ creatorId, creationIdempotencyKey: key, deletedAt: { $exists: false } });
    return doc ? toDomain(doc) : null;
  }

  /**
   * The current slug wins; otherwise a campaign that used this slug before, so
   * shared links survive a slug change. Slug uniqueness (creation and
   * SetCampaignSlug) goes through this lookup, so a released slug can never be
   * claimed by another campaign.
   */
  async findBySlug(slug: string): Promise<CampaignEntity | null> {
    const normalized = slug.toLowerCase();
    const doc = await CampaignModel.findOne({ slug: normalized, deletedAt: { $exists: false } })
      ?? await CampaignModel.findOne({ previousSlugs: normalized, deletedAt: { $exists: false } });
    return doc ? toDomain(doc) : null;
  }

  async findAll(params: CampaignListQuery): Promise<{ items: CampaignEntity[]; total: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const sortField = params.sortBy ?? 'createdAt';
    const sortOrder: SortOrder = params.sortOrder === 'asc' ? 1 : -1;

    const conditions: FilterQuery<CampaignDocument>[] = [{ deletedAt: { $exists: false } }];
    if (!params.includeNonPublic) conditions.push({ status: { $in: PUBLIC_CAMPAIGN_STATUSES } });
    if (params.status) conditions.push(effectiveStatusFilter(params.status, new Date()));
    if (params.category) conditions.push({ category: params.category });
    if (params.q) conditions.push({ title: { $regex: escapeRegex(params.q), $options: 'i' } });
    const filter: FilterQuery<CampaignDocument> = { $and: conditions };

    // `_id` breaks ties so a page boundary never repeats or skips a campaign.
    const [docs, total] = await Promise.all([
      sortField === 'fundedPercent'
        ? CampaignModel.aggregate<CampaignDocument>([
            { $match: filter },
            { $addFields: { fundedRatio: { $cond: [{ $gt: ['$goalAmount', 0] }, { $divide: ['$raisedAmount', '$goalAmount'] }, 0] } } },
            { $sort: { fundedRatio: sortOrder, _id: sortOrder } },
            { $skip: skip },
            { $limit: pageSize },
          ])
        : CampaignModel.find(filter)
            .sort({ [sortField]: sortOrder, _id: sortOrder })
            .skip(skip)
            .limit(pageSize),
      CampaignModel.countDocuments(filter),
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

  async setSlug(id: string, expectedSlug: string, slug: string): Promise<CampaignEntity | null> {
    const doc = await CampaignModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false }, ...(expectedSlug ? { slug: expectedSlug } : { $or: [{ slug: '' }, { slug: null }] }) },
      { $set: { slug }, ...(expectedSlug ? { $addToSet: { previousSlugs: expectedSlug } } : {}) }, { new: true },
    );
    return doc ? toDomain(doc) : null;
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

  /**
   * Campaigns occupying one of the plan's concurrent-campaign slots.
   *
   * FUNDED counts: now that overfunding is allowed, reaching the goal no longer
   * closes a campaign, so a funded one is still live and collecting. Excluding
   * it would let a creator run unlimited simultaneous campaigns simply by
   * getting each to its goal. Only campaigns that are genuinely finished or
   * never started (EXPIRED / BLOCKED / DRAFT) free their slot.
   *
   * "Finished" is decided by the end date, not only the stored status: the
   * expiry sweep runs periodically, and an ended campaign must free its slot at
   * once rather than lock a Free organiser out until the next sweep. An ended
   * PENDING_REVIEW campaign frees its slot too, because staff can no longer
   * approve it (review refuses expired campaigns).
   */
  async countActiveByCreator(creatorId: string): Promise<number> {
    return CampaignModel.countDocuments({
      creatorId,
      deletedAt: { $exists: false },
      status: {
        $in: [CampaignStatus.ACTIVE, CampaignStatus.PENDING_REVIEW, CampaignStatus.FUNDED],
      },
      endDate: { $gt: new Date() },
    });
  }

  async expireEnded(now: Date): Promise<number> {
    // Status only: balances and splits key on the ledger, and donations were
    // already refused once the end date passed. Payout rails do check the
    // label, through PAYABLE_CAMPAIGN_STATUSES, which treats EXPIRED as payable.
    const result = await CampaignModel.updateMany(
      { deletedAt: { $exists: false }, status: { $in: OPEN_STATUSES }, endDate: { $lte: now } },
      { $set: { status: CampaignStatus.EXPIRED } }
    );
    return result.modifiedCount;
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
