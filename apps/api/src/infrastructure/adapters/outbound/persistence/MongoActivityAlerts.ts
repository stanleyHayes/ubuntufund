import mongoose from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import type { ActivityAlertCategory } from '@ubuntu-fund/types';
import { ActivityAlertPreferenceModel } from '../../../database/models/ActivityAlertPreferenceModel.js';
import { ActivityAlertDeliveryModel } from '../../../database/models/ActivityAlertDeliveryModel.js';
import { NotificationModel } from '../../../database/models/NotificationModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { DonationModel } from '../../../database/models/DonationModel.js';
import { PayoutModel } from '../../../database/models/PayoutModel.js';
import { CreatorPayoutModel } from '../../../database/models/CreatorPayoutModel.js';
import { BeneficiaryPayoutModel } from '../../../database/models/BeneficiaryPayoutModel.js';
import { TipModel } from '../../../database/models/TipModel.js';
import { RefundModel } from '../../../database/models/RefundModel.js';
import { WalletTransactionModel } from '../../../database/models/WalletTransactionModel.js';
import { SubscriptionModel } from '../../../database/models/SubscriptionModel.js';

interface SourceRecord { _id: mongoose.Types.ObjectId; activityRevision: number; activityOccurredAt: Date; [key: string]: unknown }
interface Event { key: string; userId: string; category: ActivityAlertCategory; title: string; body: string; path: string; occurredAt: Date }
export interface ActivityEmailSender { configured: boolean; send(key: string, payload: Record<string, unknown>): Promise<void>; from: string; replyTo: string; webUrl: string }
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const text = (value: unknown) => typeof value === 'string' ? value : '';
const amount = (row: SourceRecord) => `${text(row.currency) || 'GHS'} ${Number(row.amount).toFixed(2)}`;
const sources = [
  ['donation', DonationModel.collection.name], ['payout', PayoutModel.collection.name],
  ['creatorPayout', CreatorPayoutModel.collection.name], ['beneficiaryPayout', BeneficiaryPayoutModel.collection.name],
  ['tip', TipModel.collection.name], ['refund', RefundModel.collection.name],
  ['wallet', WalletTransactionModel.collection.name], ['subscription', SubscriptionModel.collection.name],
] as const;

/** Financial writes only set an atomic marker; this worker captures and delivers alerts independently. */
export class MongoActivityAlerts {
  constructor(private readonly email: ActivityEmailSender) {}

  async capture(event: Event): Promise<void> {
    if (!event.userId || !/^[a-f0-9]{24}$/i.test(event.userId)) return; // Guest identities are never guessed from an email.
    const [user, preferences] = await Promise.all([
      UserModel.exists({ _id: event.userId, deletedAt: null }), ActivityAlertPreferenceModel.findOne({ userId: event.userId }),
    ]);
    if (!user) return;
    for (const channel of ['inApp', 'email'] as const) {
      const choice = preferences?.choices.get(`${event.category}_${channel}`);
      if (!choice?.enabled || !choice.enabledAt || choice.enabledAt > event.occurredAt) continue;
      const id = hash(`${event.key}:${event.userId}:${channel}`);
      await ActivityAlertDeliveryModel.updateOne({ _id: id }, { $setOnInsert: { ...event, channel, nextAttemptAt: new Date(), status: 'pending' } }, { upsert: true });
    }
  }

  async capturePending(limit = 100): Promise<void> {
    if (!mongoose.connection.db) return;
    for (const [kind, collectionName] of sources) {
      const collection = mongoose.connection.db.collection<SourceRecord>(collectionName);
      const rows = await collection.find({ activityPending: true, activityNextCheckAt: { $lte: new Date() } }).sort({ activityNextCheckAt: 1 }).limit(Math.min(limit, 500)).toArray();
      for (const row of rows) {
        try {
        // Do not announce a credit while its settlement is still being repaired.
        const waiting = ((kind === 'tip' && row.status === 'SUCCEEDED') ||
          (['payout', 'creatorPayout', 'beneficiaryPayout'].includes(kind) && ['PAID', 'REVERSED'].includes(text(row.status)))) && row.settlementApplied !== true;
        if (waiting) {
          await collection.updateOne({ _id: row._id, activityRevision: row.activityRevision }, { $set: { activityNextCheckAt: new Date(Date.now() + 60_000) } });
          continue;
        }
        for (const event of await this.events(kind, row)) await this.capture(event);
        const end = row.currentPeriodEnd instanceof Date ? row.currentPeriodEnd : null;
        const checkExpiry = kind === 'subscription' && row.tier !== 'free' && row.status === 'active' && end && end > new Date();
        // A concurrent financial change owns a newer revision and keeps its pending marker.
        await collection.updateOne({ _id: row._id, activityRevision: row.activityRevision }, { $set: {
          activityPending: !!checkExpiry, ...(checkExpiry ? { activityNextCheckAt: end } : {}),
        }, $unset: { activityError: 1 } });
        } catch {
          await collection.updateOne({ _id: row._id, activityRevision: row.activityRevision }, { $set: { activityNextCheckAt: new Date(Date.now() + 60_000), activityError: 'activity_capture_retry_pending' } });
        }
      }
    }
  }

  private async events(kind: string, row: SourceRecord): Promise<Event[]> {
    const date = row.activityOccurredAt;
    if (!(date instanceof Date)) return [];
    const state = text(row.status);
    const base = `${kind}:${row._id}:${state}`;
    const event = (userId: string, category: ActivityAlertCategory, title: string, body: string, path: string, key = base, occurredAt = date): Event => ({ userId, category, title, body, path, key, occurredAt });
    const campaign = ['donation', 'payout', 'beneficiaryPayout'].includes(kind)
      ? await CampaignModel.findById(row.campaignId).select('creatorId title').lean() : null;
    if (kind === 'donation') {
      const title = campaign?.title || 'a campaign';
      return [
        ...(campaign ? [event(campaign.creatorId, 'donationsReceived', 'Your campaign received a donation', `A supporter donated ${amount(row)} to “${title}”.`, `/campaigns/${row.campaignId}`, `${base}:owner`)] : []),
        event(text(row.donorId), 'donationsSent', 'Your donation is confirmed', `Your donation of ${amount(row)} to “${title}” is confirmed. This payment confirmation is not a charitable tax certificate.`, '/donations', `${base}:donor`),
      ];
    }
    if (kind === 'tip' && state === 'SUCCEEDED') return [
      event(text(row.creatorUserId), 'creatorTips', 'You received creator support', `A supporter sent ${amount(row)}. Review your creator balance for applicable withdrawal fees.`, '/creator', `${base}:creator`),
      event(text(row.supporterUserId), 'donationsSent', 'Your creator support is confirmed', `Your creator payment of ${amount(row)} is confirmed.`, '/dashboard', `${base}:supporter`),
    ];
    if (['payout', 'creatorPayout', 'beneficiaryPayout'].includes(kind)) {
      const labels: Record<string, string> = { PENDING: 'requested', PROCESSING: 'processing', PAID: 'completed', FAILED: 'failed', REVERSED: 'reversed', NEEDS_REVIEW: 'awaiting review' };
      if (!labels[state]) return [];
      // A request closed before any transfer is "rejected"/"cancelled", not a failed transfer.
      const closure = (row as { closure?: { kind?: string } }).closure?.kind;
      if (state === 'FAILED' && (closure === 'rejected' || closure === 'cancelled')) labels.FAILED = closure;
      const owner = kind === 'creatorPayout' ? text(row.creatorUserId) : campaign?.creatorId;
      return owner ? [event(owner, 'withdrawals', `Your ${kind === 'beneficiaryPayout' ? 'beneficiary payout' : 'withdrawal'} is ${labels[state]}`, `The ${amount(row)} request is ${labels[state]}. Open your payout history for fees, net amount and the latest status.`, kind === 'creatorPayout' ? '/creator' : `/campaigns/${row.campaignId}`)] : [];
    }
    if (kind === 'refund') return [event(text(row.requesterId), 'refunds', `Your refund is ${state}`, `Your refund request for ${amount(row)} is ${state}. Check the refund details for the approved amount and payment progress.`, '/refunds')];
    if (kind === 'wallet' && ['deposit', 'transfer', 'withdrawal'].includes(text(row.type))) return [event(text(row.userId), 'wallet', `Wallet ${row.type}: ${state}`, `Your wallet ${row.type} of ${amount(row)} is ${state}. Review your wallet history for details.`, '/wallet')];
    if (kind === 'subscription' && row.tier !== 'free') {
      const end = row.currentPeriodEnd instanceof Date ? row.currentPeriodEnd : null;
      const expired = end && end <= new Date();
      const label = expired ? 'expired' : row.cancelAtPeriodEnd ? 'scheduled to end' : state;
      return [event(text(row.userId), 'subscriptions', `Subscription ${label}`, `Your ${row.tier} subscription is ${label}.${end ? ` The current access period ends ${end.toISOString().slice(0, 10)}.` : ''} Manage billing with the provider shown in your subscription settings.`, '/subscription', `${base}:${row.tier}:${end?.toISOString()}:${label}`, expired ? end : date)];
    }
    return [];
  }

  async deliverPending(limit = 100): Promise<void> {
    for (let index = 0; index < Math.min(limit, 500); index++) {
      const now = new Date(), leaseToken = randomUUID();
      const row = await ActivityAlertDeliveryModel.findOneAndUpdate({ status: 'pending', nextAttemptAt: { $lte: now }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
        { $set: { leaseToken, leaseUntil: new Date(now.getTime() + 60_000) } }, { new: true, sort: { nextAttemptAt: 1 } }).select('+emailRequest');
      if (!row) return;
      const match = { _id: row._id, status: 'pending', leaseToken };
      try {
        const [user, preferences] = await Promise.all([UserModel.findOne({ _id: row.userId, deletedAt: null }), ActivityAlertPreferenceModel.findOne({ userId: row.userId })]);
        const choice = preferences?.choices.get(`${row.category}_${row.channel}`);
        if (!user || !choice?.enabled || !choice.enabledAt || choice.enabledAt > row.occurredAt || (row.channel === 'email' && !user.emailVerified)) {
          await ActivityAlertDeliveryModel.updateOne(match, { $set: { status: 'suppressed' }, $unset: { leaseToken: 1, leaseUntil: 1, emailRequest: 1 } }); continue;
        }
        if (row.channel === 'inApp') {
          await NotificationModel.updateOne({ _id: row._id.slice(0, 24) }, { $setOnInsert: { userId: row.userId, title: row.title, body: row.body, type: row.category, path: row.path, createdAt: row.occurredAt, read: false } }, { upsert: true });
        } else {
          // An ambiguous retry must keep its original payload for idempotency, but
          // must never send to an address the account no longer owns.
          if (row.emailRequest && (!Array.isArray(row.emailRequest.to) || row.emailRequest.to.length !== 1 || row.emailRequest.to[0] !== user.email)) {
            await ActivityAlertDeliveryModel.updateOne(match, { $set: { status: 'suppressed', lastError: 'email_address_changed' }, $unset: { leaseToken: 1, leaseUntil: 1, emailRequest: 1 } }); continue;
          }
          if (!this.email.configured) {
            await ActivityAlertDeliveryModel.updateOne(match, { $set: { nextAttemptAt: new Date(Date.now() + 60_000), lastError: 'email_not_configured' }, $unset: { leaseToken: 1, leaseUntil: 1 } }); continue;
          }
          // Resend keeps idempotency keys for 24h. Never blindly resend an ambiguous older attempt.
          if (row.firstAttemptAt && Date.now() - row.firstAttemptAt.getTime() >= 23 * 60 * 60_000) {
            await ActivityAlertDeliveryModel.updateOne(match, { $set: { status: 'review', lastError: 'email_delivery_requires_review' }, $unset: { leaseToken: 1, leaseUntil: 1 } }); continue;
          }
          const payload = row.emailRequest ?? { from: this.email.from, reply_to: this.email.replyTo, to: [user.email], subject: row.title,
            text: `${row.body}\n\nView details: ${this.email.webUrl}${row.path}\n\nYou opted in to this activity email. Change your choices: ${this.email.webUrl}/settings\nSupport: ${this.email.replyTo}` };
          await ActivityAlertDeliveryModel.updateOne(match, { $set: { emailRequest: payload, firstAttemptAt: row.firstAttemptAt ?? new Date() }, $inc: { attempts: 1 } });
          await this.email.send(`activity/${row._id}`, payload);
        }
        await ActivityAlertDeliveryModel.updateOne(match, { $set: { status: 'delivered', deliveredAt: new Date() }, $unset: { leaseToken: 1, leaseUntil: 1, lastError: 1, emailRequest: 1 } });
      } catch {
        await ActivityAlertDeliveryModel.updateOne(match, { $set: { nextAttemptAt: new Date(Date.now() + 60_000), lastError: 'activity_delivery_retry_pending' }, $unset: { leaseToken: 1, leaseUntil: 1 } });
      }
    }
  }
}
