import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import type {
  DisputeRepositoryPort,
  DisputeRecord,
  DisputeListParams,
  DisputeResolution,
  ProviderDisputeInput,
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
    source: doc.source,
    providerDisputeId: doc.providerDisputeId,
    transactionReference: doc.transactionReference,
    donationIntentId: doc.donationIntentId,
    amount: doc.amount,
    currency: doc.currency,
    dueAt: doc.dueAt,
    providerStatus: doc.providerStatus,
    providerResolution: doc.providerResolution,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Reporter id recorded on provider-originated cases (not a user id). */
export const PROVIDER_REPORTER_ID = 'system:paystack';

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

  async upsertProviderDispute(
    input: ProviderDisputeInput
  ): Promise<{ record: DisputeRecord; created: boolean }> {
    // The unique providerDisputeId index must exist before the first write.
    await DisputeModel.init();
    try {
      return await this.upsertProviderDisputeOnce(input);
    } catch (error) {
      // A concurrent delivery created the row first: update that one instead.
      if ((error as { code?: number }).code === 11000) return this.upsertProviderDisputeOnce(input);
      throw error;
    }
  }

  private async upsertProviderDisputeOnce(
    input: ProviderDisputeInput
  ): Promise<{ record: DisputeRecord; created: boolean }> {
    return new MongoUnitOfWork().run(async () => {
      // Same campaign write lock as staff disputes, so a payout approval that
      // raced this case re-reads the dispute state.
      await this.lockCampaign(input.campaignId);
      const existing = await DisputeModel.findOne({ providerDisputeId: input.providerDisputeId });
      const provider = {
        ...(input.providerStatus !== undefined ? { providerStatus: input.providerStatus } : {}),
        ...(input.providerResolution !== undefined ? { providerResolution: input.providerResolution } : {}),
        ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      };
      if (!existing) {
        const doc = await DisputeModel.create({
          campaignId: input.campaignId,
          reporterId: PROVIDER_REPORTER_ID,
          reason: input.reason,
          description: input.description,
          // A case first seen already closed at the provider still needs staff
          // to account for it.
          status: input.providerClosed ? 'under_review' : 'open',
          source: input.source,
          providerDisputeId: input.providerDisputeId,
          transactionReference: input.transactionReference,
          donationIntentId: input.donationIntentId,
          amount: input.amount,
          currency: input.currency,
          ...provider,
        });
        return { record: toDomain(doc), created: true };
      }
      const doc = await DisputeModel.findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            ...provider,
            // Never reopen or auto-close a case staff have handled; a provider
            // close moves an open case to review.
            ...(input.providerClosed && existing.status === 'open' ? { status: 'under_review' } : {}),
          },
        },
        { new: true }
      );
      return { record: toDomain(doc ?? existing), created: false };
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
