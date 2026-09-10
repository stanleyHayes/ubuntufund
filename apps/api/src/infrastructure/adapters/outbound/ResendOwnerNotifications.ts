import { UserModel } from '../../database/models/UserModel.js';
import { ProfileModel } from '../../database/models/ProfileModel.js';
import { NotificationModel } from '../../database/models/NotificationModel.js';

/** Inbox delivery is independent; email retries use a stable provider idempotency key. */
export class ResendOwnerNotifications {
  constructor(private readonly apiKey: string, private readonly from: string, private readonly webUrl: string) {}
  async send(userId: string, notificationId: string, title: string, text: string): Promise<void> {
    if (!this.apiKey || !this.from) return;
    const notice = await NotificationModel.findById(notificationId);
    if (notice?.emailSentAt) return;
    const [user, profile] = await Promise.all([UserModel.findById(userId), ProfileModel.findOne({ userId })]);
    if (!user || profile?.notificationPreferences?.email === false || profile?.notificationPreferences?.campaignUpdates === false) return;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `donation-owner/${notificationId}` },
      body: JSON.stringify({ from: this.from, to: [user.email], subject: title, text: `${text}\n\nView your notifications: ${this.webUrl}/dashboard` }),
    });
    if (!res.ok) throw new Error(`Owner notification email failed (${res.status})`);
    await NotificationModel.updateOne({ _id: notificationId }, { $set: { emailSentAt: new Date() } });
  }
}
