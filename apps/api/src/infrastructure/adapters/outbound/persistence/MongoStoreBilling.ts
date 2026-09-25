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
const DAY_MS = 24 * 60 * 60_000;
/** Apple and Google keep retrying a failed renewal for up to 60 days. */
const STORE_RENEWAL_RETRY_MS = 60 * DAY_MS;
/**
 * How often a purchase that can no longer charge or entitle is re-checked.
 * A resubscription arrives as a store notification, so this is only a backstop.
 */
const DORMANT_RECHECK_MS = 30 * DAY_MS;

/** Inactive, not renewing, and past the store's billing-retry window. */
const isDormant = (purchase: Pick<VerifiedStorePurchase, 'active' | 'autoRenew' | 'periodEnd'>, now: Date) =>
  !purchase.active && !purchase.autoRenew && purchase.periodEnd.getTime() < now.getTime() - STORE_RENEWAL_RETRY_MS;

/**
 * A second, separately charged store subscription while another plan is still
 * active. Still a 409 to the client, but the charge is real, so the purchase is
 * recorded for staff review rather than dropped.
 */
export class DuplicateStorePurchaseError extends AppError {
  constructor() {
    super('Another subscription is already active. Contact support to review the duplicate purchase.', 409);
  }
}

export class MongoStoreBilling extends MongoBillingOwnership {
  constructor(private readonly verifier: StorePurchaseVerifierPort, private readonly cipher: StoreReceiptCipher) { super(); }

  /**
   * Called for native purchase/restore (the member) and by the reconcile sweep
   * and store notifications (`serverInitiated`). Only verified account binding
   * establishes ownership.
   */
  async verifyForUser(userId: string, store: BillingStore, reference: string, options: { serverInitiated?: boolean } = {}) {
    const account = await this.account(userId);
    const revision = await this.nextRevision(userId);
    const purchase = await this.verifier.verify(store, reference);
    if (purchase.accountToken !== account.accountToken) {
      throw new AppError('This purchase belongs to a different Ujimora account. Sign in to the account used for the purchase.', 403);
    }
    if (options.serverInitiated && account.provider && account.provider !== store && !purchase.active && !purchase.autoRenew) {
      // The member has moved to another rail, and this purchase can no longer
      // charge or entitle them. A background re-check must not take the rail
      // back (and overwrite their plan with this old one) once that other plan
      // lapses, nor flag it for review while it runs: only record what the
      // store says. The member's own restore, or a new store notification for
      // an active purchase, can still switch.
      await this.recordObserved(userId, purchase, revision);
      return { active: false, applied: false };
    }
    // The verified purchase row is now the durable evidence for this rail.
    await this.claimProvider(userId, store, { refreshHold: options.serverInitiated ? false : 'on-switch' });
    try {
      return await this.apply(userId, purchase, revision);
    } catch (error) {
      if (error instanceof DuplicateStorePurchaseError) await this.recordDuplicate(userId, purchase, revision);
      throw error;
    }
  }

  /**
   * Keep a charged duplicate visible to staff (Admin → Store billing recovery)
   * after the entitlement transaction refused it. The subscription and applied
   * revision are untouched and nothing is acknowledged, so Google refunds an
   * unacknowledged purchase automatically; Apple purchases need the member to
   * request a refund from Apple. It is re-verified daily and applied once the
   * other plan lapses.
   */
  private async recordDuplicate(userId: string, purchase: VerifiedStorePurchase, revision: number): Promise<void> {
    const now = new Date();
    try {
      await StorePurchaseModel.findOneAndUpdate({
        _id: storePurchaseKey(purchase.store, purchase.reference), userId,
        $or: [{ verificationRevision: { $lt: revision } }, { verificationRevision: { $exists: false } }],
      }, { $set: {
        userId, store: purchase.store, referenceCiphertext: this.cipher.encrypt(purchase.store, purchase.reference),
        productId: purchase.productId, basePlanId: purchase.basePlanId, environment: purchase.environment,
        active: purchase.active, autoRenew: purchase.autoRenew, periodEnd: purchase.periodEnd,
        acknowledgementPending: false, nextCheckAt: new Date(now.getTime() + DAY_MS), lastCheckedAt: now,
        verificationRevision: revision, reviewRequired: true, lastError: 'duplicate_active_subscription',
      } }, { upsert: true });
    } catch (error) {
      // A newer verification (or another owner's row) already holds the key.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }

  /** Refresh a purchase's observed store state without applying it or touching the claim. */
  private async recordObserved(userId: string, purchase: VerifiedStorePurchase, revision: number): Promise<void> {
    const now = new Date();
    try {
      await StorePurchaseModel.findOneAndUpdate({
        _id: storePurchaseKey(purchase.store, purchase.reference), userId,
        $or: [{ verificationRevision: { $lt: revision } }, { verificationRevision: { $exists: false } }],
      }, { $set: {
        userId, store: purchase.store, referenceCiphertext: this.cipher.encrypt(purchase.store, purchase.reference),
        productId: purchase.productId, basePlanId: purchase.basePlanId, environment: purchase.environment,
        active: purchase.active, autoRenew: purchase.autoRenew, periodEnd: purchase.periodEnd,
        acknowledgementPending: false, lastCheckedAt: now, verificationRevision: revision, reviewRequired: false,
        nextCheckAt: new Date(now.getTime() + (isDormant(purchase, now) ? DORMANT_RECHECK_MS : DAY_MS)),
      }, $unset: { lastError: 1 } }, { upsert: true });
    } catch (error) {
      // A newer verification (or another owner's row) already holds the key.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
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
        await this.verifyForUser(account.userId, row.store, reference, { serverInitiated: true });
        await StoreBillingNotificationModel.deleteOne({ _id: row._id, revision: row.revision, processingToken });
        // A newer notification may have arrived while this one was processed.
        await StoreBillingNotificationModel.updateOne({ _id: row._id, processingToken },
          { $unset: { leaseUntil: 1, processingToken: 1 } });
      } catch (error) {
        const status = error instanceof AppError ? error.statusCode : 503;
        const lastError = error instanceof DuplicateStorePurchaseError ? 'duplicate_active_subscription'
          : status < 500 ? 'notification_review_required' : 'notification_retry_pending';
        await StoreBillingNotificationModel.updateOne({ _id: row._id, processingToken, revision: row.revision }, {
          $set: { reviewRequired: status < 500, lastError,
            nextAttemptAt: new Date(Date.now() + (status < 500 ? 24 * 60 * 60_000 : RETRY_MS)) },
          $unset: { leaseUntil: 1, processingToken: 1 },
        });
        // A newer notification keeps its immediate retry time even if this older lookup failed.
        await StoreBillingNotificationModel.updateOne({ _id: row._id, processingToken },
          { $unset: { leaseUntil: 1, processingToken: 1 } });
      }
    }
  }

  /**
   * Store purchases deliberately earn no affiliate commission: the store gives
   * no price to base it on, and the programme is advertised as web-only. Only
   * web settlement (SettleSubscriptionUseCase) records commissions.
   */
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
        throw new DuplicateStorePurchaseError();
      }
      if (existingPurchase && existingPurchase.verificationRevision > revision) return { active: existingPurchase.active, applied: false };
      const now = new Date();
      await StorePurchaseModel.findOneAndUpdate({ _id: key }, { $set: {
        userId, store: purchase.store, referenceCiphertext: this.cipher.encrypt(purchase.store, purchase.reference),
        productId: purchase.productId, basePlanId: purchase.basePlanId, environment: purchase.environment,
        active: purchase.active, autoRenew: purchase.autoRenew, periodEnd: purchase.periodEnd,
        acknowledgementPending: purchase.active && purchase.needsAcknowledgement,
        // A purchase that can no longer charge or entitle is not re-verified
        // every 15 minutes forever.
        nextCheckAt: new Date(now.getTime() + (isDormant(purchase, now) ? DORMANT_RECHECK_MS : RECHECK_MS)),
        lastCheckedAt: now, verificationRevision: revision,
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
        }, $unset: { trialEnd: 1, paymentReferences: 1 } }, { upsert: true });
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
        await this.verifyForUser(row.userId, row.store, this.cipher.decrypt(row.store, row.referenceCiphertext), { serverInitiated: true });
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
