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
  async save(dispute: DisputeRecord): Promise<DisputeRecord> {
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
  }
}
