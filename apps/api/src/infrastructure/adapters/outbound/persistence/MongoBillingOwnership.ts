import { SubscriptionTier } from '@ubuntu-fund/types';
import type { BillingOwnershipPort } from '../../../../domain/ports/outbound/BillingOwnershipPort.js';
import type { BillingStore } from '../../../../domain/ports/outbound/StorePurchaseVerifierPort.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { StoreBillingAccountModel } from '../../../database/models/StoreBillingAccountModel.js';
import { StorePurchaseModel } from '../../../database/models/StorePurchaseModel.js';
import { SubscriptionModel } from '../../../database/models/SubscriptionModel.js';
import { SubscriptionCheckoutModel } from '../../../database/models/SubscriptionCheckoutModel.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';

const railName = (provider: string) => provider === 'apple' ? 'the App Store' : provider === 'google' ? 'Google Play' : 'web billing';

type BillingProvider = 'web' | BillingStore;

/**
 * How long a claim stays binding after it was last made, even with nothing to
 * show for it yet: a web payment window or a native store sheet opened just
 * before may still complete. Matches the web checkout lifetime.
 */
export const PROVIDER_CLAIM_HOLD_MS = 24 * 60 * 60 * 1000;
/** Apple and Google keep retrying a failed renewal for up to 60 days. */
const STORE_RENEWAL_RETRY_MS = 60 * 24 * 60 * 60 * 1000;

/** Available even during a store-provider outage, so web cannot double-charge. */
export class MongoBillingOwnership implements BillingOwnershipPort {
  protected readonly transaction = new MongoUnitOfWork();
  async account(userId: string) {
    try {
      return (await StoreBillingAccountModel.findOneAndUpdate({ userId }, { $setOnInsert: { userId } },
        { new: true, upsert: true }))!;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const account = await StoreBillingAccountModel.findOne({ userId });
      if (!account) throw error;
      return account;
    }
  }

  async claimProvider(userId: string, provider: BillingProvider, options: { refreshHold?: boolean } = {}): Promise<void> {
    await this.account(userId);
    await this.transaction.run(async () => {
      const account = (await StoreBillingAccountModel.findOne({ userId }))!;
      const now = new Date();
      if (account.provider && account.provider !== provider) {
        // The claim is the anti-double-billing lock, but it must not be
        // permanent: an abandoned web checkout or a cancelled store sheet would
        // otherwise lock the account to that rail forever. It moves only when
        // the holding rail has nothing live that could still charge or entitle.
        if (await this.holdsLiveObligation(userId, account.provider as BillingProvider, account, now)) {
          throw new AppError(`This account manages subscriptions through ${railName(account.provider)}. Use that billing service to avoid a second subscription.`, 409);
        }
        if (provider === 'web' && account.provider !== 'web') {
          // The lapsed store row becomes an ordinary lapsed web row, so web
          // settlement may update it (store-billed rows are write-protected).
          await SubscriptionModel.updateOne({ userId, billingProvider: account.provider },
            { $set: { billingProvider: 'web' }, $unset: { storePurchaseKey: 1, billingEnvironment: 1 } });
        }
      }
      if (!account.provider && provider !== 'web') {
        const subscription = await SubscriptionModel.findOne({ userId });
        const activeWebPlan = subscription && !['apple', 'google'].includes(subscription.billingProvider ?? '') &&
          subscription.tier !== SubscriptionTier.FREE && subscription.currentPeriodEnd > now &&
          ['active', 'trialing'].includes(subscription.status);
        const pendingWebPayment = await SubscriptionCheckoutModel.exists({ userId, status: 'pending',
          createdAt: { $gt: new Date(now.getTime() - PROVIDER_CLAIM_HOLD_MS) } });
        if (activeWebPlan || pendingWebPayment) {
          throw new AppError('An existing web subscription or pending payment must be resolved before starting store billing.', 409);
        }
      }
      // Re-verifying an existing store purchase (every sweep) must not keep
      // renewing the in-flight hold, or a store claim could never be released.
      const refreshHold = options.refreshHold !== false || account.provider !== provider;
      await StoreBillingAccountModel.updateOne({ _id: account._id },
        { $set: { provider, ...(refreshHold ? { providerClaimedAt: now } : {}) } });
    });
  }

  /**
   * The rail this account is currently bound to, or null when the recorded
   * claim could be released (so clients may offer every rail again).
   */
  async activeProvider(userId: string): Promise<BillingProvider | null> {
    const account = await this.account(userId);
    if (!account.provider) return null;
    return await this.holdsLiveObligation(userId, account.provider as BillingProvider, account, new Date())
      ? account.provider as BillingProvider : null;
  }

  private async holdsLiveObligation(
    userId: string,
    holder: BillingProvider,
    account: { providerClaimedAt?: Date | null },
    now: Date
  ): Promise<boolean> {
    // A payment window or store sheet opened recently may still complete.
    // (Claims recorded before this timestamp existed are long past that hold;
    // updatedAt is no substitute, as every account read and store sweep bumps it.)
    const claimedAt = account.providerClaimedAt;
    if (claimedAt && now.getTime() - new Date(claimedAt).getTime() < PROVIDER_CLAIM_HOLD_MS) return true;

    const subscription = await SubscriptionModel.findOne({ userId });
    const planInForce = !!subscription && subscription.tier !== SubscriptionTier.FREE &&
      subscription.currentPeriodEnd > now && ['active', 'trialing'].includes(subscription.status);
    if (holder === 'web') {
      const webRow = !['apple', 'google'].includes(subscription?.billingProvider ?? '');
      if (planInForce && webRow) return true;
      return !!await SubscriptionCheckoutModel.exists({ userId, status: 'pending',
        createdAt: { $gt: new Date(now.getTime() - PROVIDER_CLAIM_HOLD_MS) } });
    }
    if (planInForce && subscription?.billingProvider === holder) return true;
    // An active purchase, or one the store may still renew (auto-renew on,
    // within the store's billing-retry window), keeps the store rail.
    return !!await StorePurchaseModel.exists({
      userId, store: holder, replacedBy: { $exists: false },
      $or: [
        { active: true, periodEnd: { $gt: now } },
        { autoRenew: true, periodEnd: { $gt: new Date(now.getTime() - STORE_RENEWAL_RETRY_MS) } },
      ],
    });
  }
}
