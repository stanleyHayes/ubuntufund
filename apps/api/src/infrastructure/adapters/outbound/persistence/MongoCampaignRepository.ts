import type { PaginationParams } from '@ubuntu-fund/types';
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
  });
}

export class MongoCampaignRepository implements CampaignRepositoryPort {
  async save(campaign: CampaignEntity): Promise<CampaignEntity> {
    const plain = campaign.toPlain();
    const doc = await CampaignModel.create({
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
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<CampaignEntity | null> {
    const doc = await CampaignModel.findById(id);
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
      CampaignModel.find()
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(pageSize),
      CampaignModel.countDocuments(),
    ]);

    return {
      items: docs.map(toDomain),
      total,
    };
  }

  async findByCreatorId(creatorId: string): Promise<CampaignEntity[]> {
    const docs = await CampaignModel.find({ creatorId });
    return docs.map(toDomain);
  }

  async update(campaign: CampaignEntity): Promise<CampaignEntity> {
    const plain = campaign.toPlain();
    const doc = await CampaignModel.findByIdAndUpdate(
      plain.id,
      {
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
    await CampaignModel.findByIdAndDelete(id);
  }

  async countByCreatorId(creatorId: string): Promise<number> {
    return CampaignModel.countDocuments({ creatorId });
  }

  async incrementRaised(
    campaignId: string,
    amount: number,
    currency: string
  ): Promise<CampaignEntity | null> {
    const doc = await CampaignModel.findOneAndUpdate(
      {
        _id: campaignId,
        status: 'active',
        currency,
        endDate: { $gt: new Date() },
      },
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
}
