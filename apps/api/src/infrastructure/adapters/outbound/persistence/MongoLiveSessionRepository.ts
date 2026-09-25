import { isObjectIdOrHexString } from 'mongoose';
import type { LiveSessionStats } from '@ubuntu-fund/types';
import { LiveSessionEntity } from '../../../../domain/entities/LiveSession.js';
import type { LiveSessionRepositoryPort } from '../../../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import {
  LiveSessionModel,
  type LiveSessionDocument,
} from '../../../database/models/LiveSessionModel.js';
import { DonationModel } from '../../../database/models/DonationModel.js';
import { logger } from '../../../logging/logger.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';

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
    // The partial unique index must exist before concurrent first broadcasts.
    await LiveSessionModel.init();
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
    // Session ids arrive from URLs and donor checkout links; a malformed one is
    // simply not a session (null), never a CastError the API turns into a 400.
    if (!isObjectIdOrHexString(id)) return null;
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

    if (Object.keys(inc).length === 0 || !isObjectIdOrHexString(id)) {
      return this.findById(id);
    }

    const doc = await LiveSessionModel.findByIdAndUpdate(
      id,
      { $inc: inc },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async reverseDonationStats(id: string, amount: number, removeDonation: boolean): Promise<void> {
    if (!isObjectIdOrHexString(id) || !(amount > 0 || removeDonation)) return;
    const lessOf = (field: string, by: number) => ({ $max: [0, { $subtract: [`$stats.${field}`, by] }] });
    await LiveSessionModel.updateOne({ _id: id }, [{
      $set: {
        'stats.amountRaised': lessOf('amountRaised', Math.max(0, amount)),
        'stats.successfulDonations': lessOf('successfulDonations', removeDonation ? 1 : 0),
      },
    }]);
  }

  async applyDonationStats(
    id: string,
    donationId: string,
    amount: number
  ): Promise<{ session: LiveSessionEntity | null; duplicate: boolean }> {
    if (!isObjectIdOrHexString(id)) return { session: null, duplicate: false };
    if (!isObjectIdOrHexString(donationId)) {
      logger.warn({ liveSessionId: id, donationId }, 'live stats skipped for an unknown donation');
      return { session: await this.findById(id), duplicate: false };
    }
    // Claim + bump commit together; a concurrent claimant hits a write
    // conflict, retries, and then sees the claim as already taken.
    return new MongoUnitOfWork().run(async () => {
      const claim = await DonationModel.updateOne(
        { _id: donationId, liveStatsAppliedAt: { $exists: false } },
        { $set: { liveStatsAppliedAt: new Date() } }
      );
      if (claim.modifiedCount !== 1) {
        // Already credited by an earlier delivery, or no such donation at all.
        const known = !!(await DonationModel.exists({ _id: donationId }));
        if (!known) logger.warn({ liveSessionId: id, donationId }, 'live stats skipped for an unknown donation');
        return { session: await this.findById(id), duplicate: known };
      }
      const doc = await LiveSessionModel.findByIdAndUpdate(
        id,
        { $inc: { 'stats.successfulDonations': 1, 'stats.amountRaised': amount } },
        { new: true }
      );
      return { session: doc ? toDomain(doc) : null, duplicate: false };
    });
  }
}
