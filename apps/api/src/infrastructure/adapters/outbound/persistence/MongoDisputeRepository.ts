import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import type {
  DisputeRepositoryPort,
  DisputeRecord,
  DisputeListParams,
  DisputeResolution,
} from '../../../../domain/ports/outbound/DisputeRepositoryPort.js';
import {
  DisputeModel,
  type DisputeDocument,
} from '../../../database/models/DisputeModel.js';

function toDomain(doc: DisputeDocument): DisputeRecord {
  return {
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    reporterId: doc.reporterId,
    assigneeId: doc.assigneeId,
    reason: doc.reason,
    description: doc.description,
    status: doc.status,
    resolution: doc.resolution,
    resolvedBy: doc.resolvedBy,
    resolvedAt: doc.resolvedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoDisputeRepository implements DisputeRepositoryPort {
  private async lockCampaign(campaignId: string) {
    const locked = await CampaignModel.updateOne({ _id: campaignId }, { $inc: { payoutWriteVersion: 1 } }, { timestamps: false });
    if (!locked.matchedCount) throw new AppError('Campaign not found', 404);
  }

  async save(dispute: DisputeRecord): Promise<DisputeRecord> {
    return new MongoUnitOfWork().run(async () => {
      await this.lockCampaign(dispute.campaignId);
      const doc = await DisputeModel.create({
        campaignId: dispute.campaignId,
        reporterId: dispute.reporterId,
        assigneeId: dispute.assigneeId,
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status,
        resolution: dispute.resolution,
        resolvedBy: dispute.resolvedBy,
        resolvedAt: dispute.resolvedAt,
    });
    return toDomain(doc);
    });
  }

  async findById(id: string): Promise<DisputeRecord | null> {
    const doc = await DisputeModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findAll(
    params: DisputeListParams
  ): Promise<{ items: DisputeRecord[]; total: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const filter = params.status ? { status: params.status } : {};

    const [docs, total] = await Promise.all([
      DisputeModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      DisputeModel.countDocuments(filter),
    ]);

    return { items: docs.map(toDomain), total };
  }

  async updateStatus(
    id: string,
    updates: DisputeResolution
  ): Promise<DisputeRecord | null> {
    return new MongoUnitOfWork().run(async () => {
      const existing = await DisputeModel.findById(id);
      if (!existing) return null;
      await this.lockCampaign(existing.campaignId);
      const doc = await DisputeModel.findByIdAndUpdate(
        id,
        {
          status: updates.status,
          resolution: updates.resolution,
          resolvedBy: updates.resolvedBy,
          resolvedAt: new Date(),
        },
        { new: true }
      );
      return doc ? toDomain(doc) : null;
    });
  }
}
