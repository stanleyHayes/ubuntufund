import { createHash, randomBytes } from 'node:crypto';
import type { AccountEmails } from '../../infrastructure/adapters/outbound/AccountEmails.js';
import { NewsletterSubscriptionModel } from '../../infrastructure/database/models/NewsletterSubscriptionModel.js';
import { NewsletterConsentTokenModel } from '../../infrastructure/database/models/NewsletterConsentTokenModel.js';
import { NewsletterConsentEventModel } from '../../infrastructure/database/models/NewsletterConsentEventModel.js';
import { MongoUnitOfWork } from '../../infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const consentVersion = 'newsletter-2026-09-12';
export class NewsletterConsentService {
  constructor(private readonly emails: AccountEmails) {}
  async request(email: string, source: 'public' | 'settings'): Promise<void> {
    if (!this.emails.configured) throw new AppError('Newsletter confirmation is temporarily unavailable. Please try again later.', 503);
    await new MongoUnitOfWork().run(async () => {
      const subscription = await NewsletterSubscriptionModel.findOneAndUpdate({ email }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true, new: true }).select('+confirmationTokenHash');
      if (subscription.status === 'active' && subscription.confirmedAt && subscription.consentVersion) return;
      if (subscription.status === 'pending' && subscription.requestedAt && subscription.requestedAt.getTime() > Date.now() - 60_000) return;
      const confirm = randomBytes(32).toString('hex'), unsubscribe = randomBytes(32).toString('hex');
      const id = String(subscription._id);
      subscription.status = 'pending'; subscription.requestedAt = new Date(); subscription.consentSource = source;
      subscription.consentVersion = consentVersion; subscription.confirmationTokenHash = digest(confirm);
      subscription.confirmedAt = undefined;
      await subscription.save();
      await NewsletterConsentTokenModel.create([
        { subscriptionId: id, purpose: 'confirm', tokenHash: digest(confirm), expiresAt: new Date(Date.now() + 30 * 60_000) },
        // Old unsubscribe links remain valid after a later renewed opt-in.
        { subscriptionId: id, purpose: 'unsubscribe', tokenHash: digest(unsubscribe) },
      ]);
      await NewsletterConsentEventModel.create({ subscriptionId: id, action: 'requested', source, consentVersion });
      await this.emails.enqueueNewsletterConfirmation(id, email, confirm, unsubscribe);
    });
  }
  async confirm(raw: string): Promise<void> {
    await new MongoUnitOfWork().run(async () => {
      const tokenHash = digest(raw);
      const token = await NewsletterConsentTokenModel.findOne({ tokenHash, purpose: 'confirm', expiresAt: { $gt: new Date() } });
      const subscription = token ? await NewsletterSubscriptionModel.findOne({ _id: token.subscriptionId, status: 'pending', confirmationTokenHash: tokenHash }).select('+confirmationTokenHash') : null;
      if (!subscription) throw new AppError('This confirmation link is invalid, expired or already used. Request a new link.', 400);
      subscription.status = 'active'; subscription.confirmedAt = new Date(); subscription.confirmationTokenHash = undefined;
      await subscription.save();
      await NewsletterConsentEventModel.create({ subscriptionId: String(subscription._id), action: 'confirmed', source: 'email-link', consentVersion: subscription.consentVersion });
    });
  }
  async unsubscribe(raw: string): Promise<void> {
    await new MongoUnitOfWork().run(async () => {
      const token = await NewsletterConsentTokenModel.findOne({ tokenHash: digest(raw), purpose: 'unsubscribe' });
      if (!token) throw new AppError('This unsubscribe link is invalid. Use Settings or contact support@ujimora.com.', 400);
      await this.withdraw(token.subscriptionId, 'email-link');
    });
  }
  async withdrawByEmail(email: string): Promise<void> {
    await new MongoUnitOfWork().run(async () => {
      const subscription = await NewsletterSubscriptionModel.findOne({ email });
      if (subscription) await this.withdraw(String(subscription._id), 'settings');
    });
  }
  private async withdraw(id: string, source: string): Promise<void> {
    const subscription = await NewsletterSubscriptionModel.findOneAndUpdate({ _id: id, status: { $ne: 'unsubscribed' } }, { $set: { status: 'unsubscribed', withdrawnAt: new Date() }, $unset: { confirmationTokenHash: 1 } });
    if (subscription) await NewsletterConsentEventModel.create({ subscriptionId: id, action: 'withdrawn', source, consentVersion: subscription.consentVersion });
  }
  async preference(email: string): Promise<{ status: 'off' | 'pending' | 'active'; confirmedAt?: Date }> {
    const subscription = await NewsletterSubscriptionModel.findOne({ email });
    return { status: subscription?.status === 'active' && subscription.confirmedAt && subscription.consentVersion ? 'active' : subscription?.status === 'pending' && subscription.requestedAt ? 'pending' : 'off', ...(subscription?.confirmedAt ? { confirmedAt: subscription.confirmedAt } : {}) };
  }
}
