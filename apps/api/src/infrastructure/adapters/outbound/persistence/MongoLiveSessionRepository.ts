import type { LiveSessionStats } from '@ubuntu-fund/types';
import { LiveSessionEntity } from '../../../../domain/entities/LiveSession.js';
import type { LiveSessionRepositoryPort } from '../../../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import {
  LiveSessionModel,
  type LiveSessionDocument,
} from '../../../database/models/LiveSessionModel.js';

function toDomain(doc: LiveSessionDocument): LiveSessionEntity {
  return new LiveSessionEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    title: doc.title,
    targetAmount: doc.targetAmount,
    status: doc.status,
    overlayToken: doc.overlayToken,
    showDonorNames: doc.showDonorNames,
    showDonorMessages: doc.showDonorMessages,
    showAmounts: doc.showAmounts,
    privacyMode: doc.privacyMode,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt,
    stats: {
      scans: doc.stats.scans,
      checkoutStarts: doc.stats.checkoutStarts,
      successfulDonations: doc.stats.successfulDonations,
      amountRaised: doc.stats.amountRaised,
    },
  });
}

export class MongoLiveSessionRepository implements LiveSessionRepositoryPort {
  async save(session: LiveSessionEntity): Promise<LiveSessionEntity> {
    const plain = session.toPlain();
    const doc = await LiveSessionModel.create({
      campaignId: plain.campaignId,
      title: plain.title,
      targetAmount: plain.targetAmount,
      status: plain.status,
      overlayToken: plain.overlayToken,
      showDonorNames: plain.showDonorNames,
      showDonorMessages: plain.showDonorMessages,
      showAmounts: plain.showAmounts,
      privacyMode: plain.privacyMode,
      startedAt: plain.startedAt,
      endedAt: plain.endedAt,
      stats: plain.stats,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<LiveSessionEntity | null> {
    const doc = await LiveSessionModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignId(campaignId: string): Promise<LiveSessionEntity[]> {
    const docs = await LiveSessionModel.find({ campaignId }).sort({
      startedAt: -1,
    });
    return docs.map(toDomain);
  }

  async findActiveByCampaignId(
    campaignId: string
  ): Promise<LiveSessionEntity | null> {
    const doc = await LiveSessionModel.findOne({
      campaignId,
      status: 'active',
    }).sort({ startedAt: -1 });
    return doc ? toDomain(doc) : null;
  }

  async update(session: LiveSessionEntity): Promise<LiveSessionEntity> {
    const plain = session.toPlain();
    const doc = await LiveSessionModel.findByIdAndUpdate(
      plain.id,
      {
        title: plain.title,
        targetAmount: plain.targetAmount,
        status: plain.status,
        overlayToken: plain.overlayToken,
        showDonorNames: plain.showDonorNames,
        showDonorMessages: plain.showDonorMessages,
        showAmounts: plain.showAmounts,
        privacyMode: plain.privacyMode,
        endedAt: plain.endedAt,
      },
      { new: true }
    );
    if (!doc) {
      throw new Error(`LiveSession ${plain.id} not found`);
    }
    return toDomain(doc);
  }

  async incrementStats(
    id: string,
    delta: Partial<LiveSessionStats>
  ): Promise<LiveSessionEntity | null> {
    const inc: Record<string, number> = {};
    if (delta.scans) inc['stats.scans'] = delta.scans;
    if (delta.checkoutStarts) inc['stats.checkoutStarts'] = delta.checkoutStarts;
    if (delta.successfulDonations) {
      inc['stats.successfulDonations'] = delta.successfulDonations;
    }
    if (delta.amountRaised) inc['stats.amountRaised'] = delta.amountRaised;

    if (Object.keys(inc).length === 0) {
      return this.findById(id);
    }

    const doc = await LiveSessionModel.findByIdAndUpdate(
      id,
      { $inc: inc },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
