import { SubscriptionTier, SubscriptionStatus, BillingCycle } from '@ubuntu-fund/types';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import type { SubscriptionRecord, SubscriptionRepositoryPort } from '../../../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import {
  SubscriptionModel,
  type SubscriptionDocument,
} from '../../../database/models/SubscriptionModel.js';

function toDomain(doc: SubscriptionDocument): SubscriptionRecord {
  return {
    id: doc._id!.toString(),
    billingProvider: doc.billingProvider,
    billingEnvironment: doc.billingEnvironment,
    userId: doc.userId,
    tier: doc.tier,
    status: doc.status,
    billingCycle: doc.billingCycle,
    currentPeriodStart: doc.currentPeriodStart,
    currentPeriodEnd: doc.currentPeriodEnd,
    cancelAtPeriodEnd: doc.cancelAtPeriodEnd,
    trialEnd: doc.trialEnd,
    ...(doc.paymentReferences?.length ? { paymentReferences: [...doc.paymentReferences] } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoSubscriptionRepository implements SubscriptionRepositoryPort {
  async lockForConsumption(userId: string): Promise<void> {
    const now = new Date();
    // Materialize the same implicit Free subscription as first account access.
    // The unique user key also fences concurrent first paid-subscription inserts.
    await SubscriptionModel.updateOne({ userId }, {
      $inc: { consumptionWriteVersion: 1 },
      $setOnInsert: {
        userId, tier: SubscriptionTier.FREE, status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY, currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false, createdAt: now, updatedAt: now,
      },
    }, { upsert: true, timestamps: false });
  }
  async findByUserId(userId: string): Promise<SubscriptionRecord | null> {
    const doc = await SubscriptionModel.findOne({ userId });
    return doc ? toDomain(doc) : null;
  }

  async findById(id: string): Promise<SubscriptionRecord | null> {
    const doc = await SubscriptionModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findAll({ page, pageSize }: { page: number; pageSize: number }): Promise<{ items: SubscriptionRecord[]; total: number }> {
    const [docs, total] = await Promise.all([
      SubscriptionModel.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      SubscriptionModel.countDocuments(),
    ]);
    return { items: docs.map(toDomain), total };
  }

  async save(subscription: SubscriptionRecord): Promise<SubscriptionRecord> {
    if (subscription.tier === SubscriptionTier.FREE) {
      // Concurrent first reads may provision Community while a paid purchase
      // commits. Never overwrite or fail that existing paid entitlement.
      const doc = await SubscriptionModel.findOneAndUpdate({ userId: subscription.userId }, {
        $setOnInsert: {
          userId: subscription.userId, tier: subscription.tier, status: subscription.status,
          billingCycle: subscription.billingCycle, currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
      }, { new: true, upsert: true });
      return toDomain(doc!);
    }
    const doc = await SubscriptionModel.create({
      userId: subscription.userId,
      tier: subscription.tier,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd,
      ...(subscription.paymentReferences ? { paymentReferences: subscription.paymentReferences } : {}),
    });
    return toDomain(doc);
  }

  async update(subscription: SubscriptionRecord): Promise<SubscriptionRecord | null> {
    const doc = await SubscriptionModel.findOneAndUpdate(
      { _id: subscription.id, billingProvider: { $nin: ['apple', 'google'] } },
      {
        tier: subscription.tier,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEnd: subscription.trialEnd,
        ...(subscription.paymentReferences ? { paymentReferences: subscription.paymentReferences } : {}),
      },
      { new: true }
    );
    if (!doc && await SubscriptionModel.exists({ _id: subscription.id, billingProvider: { $in: ['apple', 'google'] } })) {
      throw new AppError('Manage this subscription through the App Store or Google Play where it was purchased.', 409);
    }
    return doc ? toDomain(doc) : null;
  }
}
