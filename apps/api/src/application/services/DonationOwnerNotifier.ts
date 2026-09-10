import { createHash } from 'node:crypto';
import type { DonationSucceededPayload } from '@ubuntu-fund/types';
import { NotificationEntity } from '../../domain/entities/Notification.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { NotificationRepositoryPort } from '../../domain/ports/outbound/NotificationRepositoryPort.js';

/** Replays safely: each settled gift produces one owner inbox item. */
export class DonationOwnerNotifier {
  constructor(
    private readonly campaigns: CampaignRepositoryPort,
    private readonly notifications: NotificationRepositoryPort,
    private readonly email?: { send(userId: string, id: string, title: string, text: string): Promise<void> }
  ) {}

  async notify(payload: DonationSucceededPayload): Promise<void> {
    const campaign = await this.campaigns.findById(payload.campaignId);
    if (!campaign) throw new Error('Donation notification campaign not found');
    const name = payload.isAnonymous ? 'An anonymous supporter' : payload.donorName?.trim() || 'A supporter';
    const amount = new Intl.NumberFormat('en-GH', { style: 'currency', currency: payload.currency }).format(payload.amount);
    const id = createHash('sha256').update(`donation-owner:${payload.donationId}:${campaign.creatorId}`).digest('hex').slice(0, 24);
    const notification = await this.notifications.save(new NotificationEntity({
      id, userId: campaign.creatorId, title: 'Your campaign received a donation',
      body: `${name} donated ${amount} to “${campaign.title}”.`,
      type: 'donation_received', read: false, createdAt: new Date(payload.createdAt),
    }));
    await this.email?.send(campaign.creatorId, id, notification.title, notification.body);
  }
}
