import type { Subscription } from '@ubuntu-fund/types';
import type { SubscriptionRepositoryPort } from '../../../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import {
  SubscriptionModel,
  type SubscriptionDocument,
} from '../../../database/models/SubscriptionModel.js';

function toDomain(doc: SubscriptionDocument): Subscription {
  return {
    id: doc._id!.toString(),
    userId: doc.userId,
    tier: doc.tier,
    status: doc.status,
    billingCycle: doc.billingCycle,
    currentPeriodStart: doc.currentPeriodStart,
    currentPeriodEnd: doc.currentPeriodEnd,
    cancelAtPeriodEnd: doc.cancelAtPeriodEnd,
    trialEnd: doc.trialEnd,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoSubscriptionRepository implements SubscriptionRepositoryPort {
  async findByUserId(userId: string): Promise<Subscription | null> {
    const doc = await SubscriptionModel.findOne({ userId });
    return doc ? toDomain(doc) : null;
  }

  async findById(id: string): Promise<Subscription | null> {
    const doc = await SubscriptionModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async save(subscription: Subscription): Promise<Subscription> {
    const doc = await SubscriptionModel.create({
      userId: subscription.userId,
      tier: subscription.tier,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd,
    });
    return toDomain(doc);
  }

  async update(subscription: Subscription): Promise<Subscription | null> {
    const doc = await SubscriptionModel.findByIdAndUpdate(
      subscription.id,
      {
        tier: subscription.tier,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEnd: subscription.trialEnd,
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
