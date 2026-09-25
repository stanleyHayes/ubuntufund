import { SubscriptionStatus, SubscriptionTier } from '@ubuntu-fund/types';
import { randomUUID } from 'node:crypto';
import type { BillingStore, StorePurchaseVerifierPort, VerifiedStorePurchase } from '../../../../domain/ports/outbound/StorePurchaseVerifierPort.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { StoreBillingAccountModel } from '../../../database/models/StoreBillingAccountModel.js';
import { StorePurchaseModel } from '../../../database/models/StorePurchaseModel.js';
import { SubscriptionModel } from '../../../database/models/SubscriptionModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { StoreBillingNotificationModel } from '../../../database/models/StoreBillingNotificationModel.js';
import { MongoBillingOwnership } from './MongoBillingOwnership.js';
import { storePurchaseKey, type StoreReceiptCipher } from '../payments/StoreReceiptCipher.js';

const RETRY_MS = 60_000;
const RECHECK_MS = 15 * 60_000;

export class MongoStoreBilling extends MongoBillingOwnership {
  constructor(private readonly verifier: StorePurchaseVerifierPort, private readonly cipher: StoreReceiptCipher) { super(); }

  /** Called for native purchase/restore. Only verified account binding establishes ownership. */
  async verifyForUser(userId: string, store: BillingStore, reference: string) {
    const account = await this.account(userId);
    const revision = await this.nextRevision(userId);
    const purchase = await this.verifier.verify(store, reference);
    if (purchase.accountToken !== account.accountToken) {
      throw new AppError('This purchase belongs to a different Ujimora account. Sign in to the account used for the purchase.', 403);
    }
    // The verified purchase row is now the durable evidence for this rail.
    await this.claimProvider(userId, store, { refreshHold: false });
    return this.apply(userId, purchase, revision);
  }

  private async nextRevision(userId: string): Promise<number> {
    const account = await StoreBillingAccountModel.findOneAndUpdate({ userId },
      { $inc: { verificationRevision: 1 } }, { new: true });
    if (!account) throw new AppError('Billing account not found.', 404);
    return account.verificationRevision;
  }

  /** Invoke only after verifying the provider signature/OIDC envelope. */
  async enqueueNotification(store: BillingStore, reference: string): Promise<void> {
    const key = storePurchaseKey(store, reference);
    await StoreBillingNotificationModel.findOneAndUpdate({ _id: key }, {
      $set: { store, referenceCiphertext: this.cipher.encrypt(store, reference), nextAttemptAt: new Date() },
      $inc: { revision: 1 },
    }, { upsert: true });
  }

  async reconcileNotifications(limit = 25): Promise<void> {
    for (let index = 0; index < Math.min(limit, 100); index += 1) {
      const now = new Date();
      const processingToken = randomUUID();
      const row = await StoreBillingNotificationModel.findOneAndUpdate({
        nextAttemptAt: { $lte: now },
        $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }],
      }, { $set: { processingToken, leaseUntil: new Date(now.getTime() + 120_000) }, $inc: { attempts: 1 } },
      { new: true, sort: { nextAttemptAt: 1 } }).select('+referenceCiphertext');
      if (!row) return;
      try {
        const reference = this.cipher.decrypt(row.store, row.referenceCiphertext);
        const verified = await this.verifier.verify(row.store, reference);
        const account = await StoreBillingAccountModel.findOne({ accountToken: verified.accountToken });
        if (!account) throw new AppError('Store notification requires account review.', 409);
        // Allocate an account revision before the final authoritative refresh.
        await this.verifyForUser(account.userId, row.store, reference);
        await StoreBillingNotificationModel.deleteOne({ _id: row._id, revision: row.revision, processingToken });
        // A newer notification may have arrived while this one was processed.
        await StoreBillingNotificationModel.updateOne({ _id: row._id, processingToken },
          { $unset: { leaseUntil: 1, processingToken: 1 } });
      } catch (error) {
        const status = error instanceof AppError ? error.statusCode : 503;
        await StoreBillingNotificationModel.updateOne({ _id: row._id, processingToken, revision: row.revision }, {
          $set: { reviewRequired: status < 500, lastError: status < 500 ? 'notification_review_required' : 'notification_retry_pending',
            nextAttemptAt: new Date(Date.now() + (status < 500 ? 24 * 60 * 60_000 : RETRY_MS)) },
          $unset: { leaseUntil: 1, processingToken: 1 },
        });
        // A newer notification keeps its immediate retry time even if this older lookup failed.
        await StoreBillingNotificationModel.updateOne({ _id: row._id, processingToken },
          { $unset: { leaseUntil: 1, processingToken: 1 } });
      }
    }
  }

  private async apply(userId: string, purchase: VerifiedStorePurchase, revision: number) {
    const key = storePurchaseKey(purchase.store, purchase.reference);
    const linkedKey = purchase.linkedReference ? storePurchaseKey(purchase.store, purchase.linkedReference) : undefined;
    const result = await this.transaction.run(async () => {
      // A delayed renewal must not reactivate an erased account.
      const user = await UserModel.exists({ _id: userId, deletedAt: null });
      if (!user) throw new AppError('The account is no longer active.', 410);
      const account = await StoreBillingAccountModel.findOne({ userId });
      if (!account || account.accountToken !== purchase.accountToken || account.provider !== purchase.store) {
        throw new AppError('The purchase account or billing provider does not match.', 409);
      }
      const existingPurchase = await StorePurchaseModel.findById(key);
      if (existingPurchase && existingPurchase.userId !== userId) throw new AppError('This purchase has already been claimed by another account.', 409);
      if (existingPurchase?.replacedBy) return { active: false, applied: false };
      const linked = linkedKey ? await StorePurchaseModel.findById(linkedKey) : null;
      if (linked && linked.userId !== userId) throw new AppError('The replaced purchase belongs to another account.', 409);
      const subscription = await SubscriptionModel.findOne({ userId });
      const samePurchase = subscription?.storePurchaseKey === key;
      const replacesCurrent = !!linkedKey && subscription?.storePurchaseKey === linkedKey;
      const otherActivePurchase = subscription && !samePurchase && !replacesCurrent &&
        subscription.tier !== SubscriptionTier.FREE && subscription.status === 'active' && subscription.currentPeriodEnd > new Date();
      if (purchase.active && otherActivePurchase) {
        throw new AppError('Another subscription is already active. Contact support to review the duplicate purchase.', 409);
      }
      if (existingPurchase && existingPurchase.verificationRevision > revision) return { active: existingPurchase.active, applied: false };
      const now = new Date();
      await StorePurchaseModel.findOneAndUpdate({ _id: key }, { $set: {
        userId, store: purchase.store, referenceCiphertext: this.cipher.encrypt(purchase.store, purchase.reference),
        productId: purchase.productId, basePlanId: purchase.basePlanId, environment: purchase.environment,
        active: purchase.active, autoRenew: purchase.autoRenew, periodEnd: purchase.periodEnd,
        acknowledgementPending: purchase.active && purchase.needsAcknowledgement,
        nextCheckAt: new Date(now.getTime() + RECHECK_MS), lastCheckedAt: now, verificationRevision: revision,
        reviewRequired: false,
      }, $unset: { lastError: 1 } }, { upsert: true });
      // Global revisions are allocated BEFORE provider calls. An older request
      // completing late cannot replace a newer applied verification.
      const canApply = revision > account.appliedRevision &&
        (samePurchase || (!purchase.pending && (replacesCurrent || purchase.active || !subscription?.storePurchaseKey)));
      if (canApply) {
        if (purchase.active && linkedKey && linked) {
          await StorePurchaseModel.updateOne({ _id: linkedKey, userId },
            { $set: { active: false, autoRenew: false, acknowledgementPending: false, replacedBy: key } });
        }
        await SubscriptionModel.findOneAndUpdate({ userId }, { $set: {
          tier: purchase.tier, status: purchase.active ? SubscriptionStatus.ACTIVE : SubscriptionStatus.EXPIRED,
          billingCycle: purchase.billingCycle, currentPeriodStart: purchase.periodStart, currentPeriodEnd: purchase.periodEnd,
          cancelAtPeriodEnd: !purchase.autoRenew, billingProvider: purchase.store, billingEnvironment: purchase.environment,
          storePurchaseKey: key,
        }, $unset: { trialEnd: 1 } }, { upsert: true });
        await StoreBillingAccountModel.updateOne({ _id: account._id }, { $set: { appliedRevision: revision } });
      }
      return { active: purchase.active, applied: canApply };
    });
    // Acknowledgement is outside the transaction and AFTER its durable commit.
    // A failed acknowledgement remains queued and never charges the user again.
    if (result.applied && purchase.active && purchase.needsAcknowledgement) {
      try {
        await this.verifier.acknowledge(purchase);
        await StorePurchaseModel.updateOne({ _id: key, verificationRevision: revision }, { $set: { acknowledgementPending: false } });
      } catch {
        await StorePurchaseModel.updateOne({ _id: key, verificationRevision: revision },
          { $set: { nextCheckAt: new Date(Date.now() + RETRY_MS), lastError: 'acknowledgement_pending' } });
      }
    }
    return result;
  }

  /** Re-verifies saved receipts; provider failures never extend the saved expiry. */
  async reconcile(limit = 25): Promise<void> {
    const due = await StorePurchaseModel.find({ nextCheckAt: { $lte: new Date() }, replacedBy: { $exists: false } })
      .select('+referenceCiphertext').sort({ nextCheckAt: 1 }).limit(Math.min(limit, 100));
    for (const row of due) {
      try {
        await this.verifyForUser(row.userId, row.store, this.cipher.decrypt(row.store, row.referenceCiphertext));
      } catch (error) {
        const status = error instanceof AppError ? error.statusCode : 503;
        await StorePurchaseModel.updateOne({ _id: row._id, verificationRevision: row.verificationRevision }, { $set: {
          nextCheckAt: new Date(Date.now() + (status < 500 ? 24 * 60 * 60_000 : RETRY_MS)),
          reviewRequired: status < 500, lastError: status < 500 ? 'purchase_review_required' : 'verification_retry_pending',
        } });
      }
    }
  }
}
