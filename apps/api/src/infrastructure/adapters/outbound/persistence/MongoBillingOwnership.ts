import { SubscriptionTier } from '@ubuntu-fund/types';
import type { BillingOwnershipPort } from '../../../../domain/ports/outbound/BillingOwnershipPort.js';
import type { BillingStore } from '../../../../domain/ports/outbound/StorePurchaseVerifierPort.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { StoreBillingAccountModel } from '../../../database/models/StoreBillingAccountModel.js';
import { SubscriptionModel } from '../../../database/models/SubscriptionModel.js';
import { SubscriptionCheckoutModel } from '../../../database/models/SubscriptionCheckoutModel.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';

const railName = (provider: string) => provider === 'apple' ? 'the App Store' : provider === 'google' ? 'Google Play' : 'web billing';

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

  async claimProvider(userId: string, provider: 'web' | BillingStore): Promise<void> {
    await this.account(userId);
    await this.transaction.run(async () => {
      const account = (await StoreBillingAccountModel.findOne({ userId }))!;
      if (account.provider && account.provider !== provider) {
        throw new AppError(`This account manages subscriptions through ${railName(account.provider)}. Use that billing service to avoid a second subscription.`, 409);
      }
      if (!account.provider && provider !== 'web') {
        const subscription = await SubscriptionModel.findOne({ userId });
        const activeWebPlan = subscription && !['apple', 'google'].includes(subscription.billingProvider ?? '') &&
          subscription.tier !== SubscriptionTier.FREE && subscription.currentPeriodEnd > new Date() &&
          ['active', 'trialing'].includes(subscription.status);
        const pendingWebPayment = await SubscriptionCheckoutModel.exists({ userId, status: 'pending' });
        if (activeWebPlan || pendingWebPayment) {
          throw new AppError('An existing web subscription or pending payment must be resolved before starting store billing.', 409);
        }
      }
      await StoreBillingAccountModel.updateOne({ _id: account._id }, { $set: { provider } });
    });
  }

}
