import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { UserEntity } from '../../../domain/entities/User.js';
import type { ActivityEmailSender } from './persistence/MongoActivityAlerts.js';
import { AccountEmailJobModel } from '../../database/models/AccountEmailJobModel.js';
import { PasswordResetTokenModel } from '../../database/models/PasswordResetTokenModel.js';
import { EmailVerificationTokenModel } from '../../database/models/EmailVerificationTokenModel.js';
import { UserModel } from '../../database/models/UserModel.js';
import { NewsletterSubscriptionModel } from '../../database/models/NewsletterSubscriptionModel.js';
import { NewsletterConsentTokenModel } from '../../database/models/NewsletterConsentTokenModel.js';
import { MongoUnitOfWork } from './persistence/MongoUnitOfWork.js';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** A short-lived encrypted outbox. Raw recovery links never enter logs or API responses. */
export class AccountEmails {
  readonly configured: boolean;
  constructor(private readonly sender: ActivityEmailSender, private readonly key: Buffer | null) {
    let secureOrigin = false;
    try { const url = new URL(sender.webUrl); secureOrigin = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash; } catch { /* unavailable */ }
    this.configured = sender.configured && key?.length === 32 && secureOrigin;
  }
  private encrypt(payload: Record<string, unknown>, tokenHash: string, purpose: string): string {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key!, iv);
    cipher.setAAD(Buffer.from(`account-${purpose}:${tokenHash}`));
    const value = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), value].map(part => part.toString('base64')).join('.');
  }
  private decrypt(value: string, tokenHash: string, purpose: string): Record<string, unknown> {
    const [iv, tag, ciphertext, extra] = value.split('.');
    if (!iv || !tag || !ciphertext || extra) throw new Error('Invalid recovery payload');
    // Pin the full 16-byte tag: GCM otherwise accepts truncated tags, which makes forgery far easier.
    const authTag = Buffer.from(tag, 'base64');
    if (authTag.length !== 16) throw new Error('Invalid recovery payload');
    const decipher = createDecipheriv('aes-256-gcm', this.key!, Buffer.from(iv, 'base64'), { authTagLength: 16 });
    decipher.setAAD(Buffer.from(`account-${purpose}:${tokenHash}`));
    decipher.setAuthTag(authTag);
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8'));
  }
  async enqueue(user: UserEntity, purpose: 'recovery' | 'verification' = 'recovery'): Promise<void> {
    if (!this.configured) throw new Error('Recovery email unavailable');
    const token = randomBytes(32).toString('hex'), tokenHash = digest(token), expiresAt = new Date(Date.now() + 30 * 60_000);
    const link = `${this.sender.webUrl}/${purpose === 'verification' ? 'verify-email' : 'reset-password'}#token=${token}`;
    const payload = { from: this.sender.from, reply_to: this.sender.replyTo, to: [user.email.value], subject: purpose === 'verification' ? 'Verify your Ujimora email address' : 'Reset your Ujimora password',
      text: purpose === 'verification'
        ? `Confirm that this email address belongs to you:\n\n${link}\n\nThis Ujimora verification link expires in 30 minutes and can be used once. Verification does not subscribe you to activity or marketing emails. If you did not request this, ignore the email.\n\nSupport: ${this.sender.replyTo}`
        : `You requested a password reset for Ujimora. Open this link to choose a new password:\n\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, ignore this email. Your password has not changed.\n\nSupport: ${this.sender.replyTo}` };
    await new MongoUnitOfWork().run(async () => {
      // Per-account cooldown survives multiple API instances and commits with the queue.
      const cooldown = purpose === 'verification' ? 'verificationEmailRequestedAt' : 'recoveryEmailRequestedAt';
      const claimed = await UserModel.findOneAndUpdate({ _id: user.id, deletedAt: null, ...(purpose === 'verification' ? { emailVerified: { $ne: true } } : {}), $or: [{ [cooldown]: { $exists: false } }, { [cooldown]: { $lte: new Date(Date.now() - 60_000) } }] }, { $set: { [cooldown]: new Date() } });
      if (!claimed) return;
      const record = { userId: user.id, tokenHash, expiresAt, authVersion: user.authVersion, emailHash: digest(user.email.value) };
      if (purpose === 'verification') await EmailVerificationTokenModel.create(record);
      else await PasswordResetTokenModel.create(record);
      await AccountEmailJobModel.create({ ...record, purpose, encryptedPayload: this.encrypt(payload, tokenHash, purpose) });
    });
  }
  async deliverPending(limit = 50): Promise<void> {
    if (!this.configured) return;
    for (let index = 0; index < limit; index++) {
      const now = new Date(), leaseToken = randomUUID();
      const job = await AccountEmailJobModel.findOneAndUpdate({ status: 'pending', expiresAt: { $gt: now }, nextAttemptAt: { $lte: now }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
        { $set: { leaseToken, leaseUntil: new Date(Date.now() + 60_000) } }, { new: true, sort: { nextAttemptAt: 1 } }).select('+encryptedPayload');
      if (!job) return;
      const match = { _id: job._id, status: 'pending', leaseToken };
      try {
        const tokenFilter = { tokenHash: job.tokenHash, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } };
        let eligible = false;
        if (job.purpose === 'newsletter_confirmation') {
          const subscription = await NewsletterSubscriptionModel.findOne({ _id: job.newsletterId, status: 'pending', confirmationTokenHash: job.tokenHash });
          const token = await NewsletterConsentTokenModel.exists({ subscriptionId: job.newsletterId, tokenHash: job.tokenHash, purpose: 'confirm', expiresAt: { $gt: new Date() } });
          eligible = !!subscription && !!token && digest(subscription.email) === job.emailHash;
        } else {
          const [user, token] = await Promise.all([UserModel.findOne({ _id: job.userId, deletedAt: null }), ['password_changed', 'data_rights_response'].includes(job.purpose) ? Promise.resolve(true) : job.purpose === 'verification' ? EmailVerificationTokenModel.exists(tokenFilter) : PasswordResetTokenModel.exists(tokenFilter)]);
          eligible = !!user && !!token && !(job.purpose === 'verification' && user.emailVerified) && (user.authVersion ?? '') === job.authVersion && digest(user.email) === job.emailHash;
        }
        if (!eligible) {
          await AccountEmailJobModel.updateOne(match, { $set: { status: 'suppressed' }, $unset: { encryptedPayload: 1, leaseToken: 1, leaseUntil: 1 } }); continue;
        }
        await AccountEmailJobModel.updateOne(match, { $inc: { attempts: 1 } });
        await this.sender.send(`account-${job.purpose}/${job._id}`, this.decrypt(job.encryptedPayload!, job.tokenHash, job.purpose));
        await AccountEmailJobModel.updateOne(match, { $set: { status: 'sent' }, $unset: { encryptedPayload: 1, leaseToken: 1, leaseUntil: 1, lastError: 1 } });
      } catch {
        await AccountEmailJobModel.updateOne(match, { $set: { nextAttemptAt: new Date(Date.now() + 60_000), lastError: 'recovery_email_retry_pending' }, $unset: { leaseToken: 1, leaseUntil: 1 } });
      }
    }
  }

  /** Called inside the credential transaction; notification failure rolls back the change. */
  async enqueuePasswordChanged(user: UserEntity): Promise<void> {
    if (!this.configured) return;
    const tokenHash = digest(randomUUID()), purpose = 'password_changed';
    const payload = { from: this.sender.from, reply_to: this.sender.replyTo, to: [user.email.value], subject: 'Your Ujimora password changed',
      text: `Your Ujimora password was changed and previous sessions have ended.\n\nIf you made this change, no action is needed. If you did not, request a new password at ${this.sender.webUrl}/forgot-password and contact ${this.sender.replyTo}.\n\nThis is an account security notice, not a marketing subscription.` };
    await AccountEmailJobModel.create({ userId: user.id, purpose, tokenHash, authVersion: user.authVersion, emailHash: digest(user.email.value), expiresAt: new Date(Date.now() + 30 * 60_000), encryptedPayload: this.encrypt(payload, tokenHash, purpose) });
  }

  /**
   * Called in the data-rights review transaction when a response is published to
   * the account. Says only that a response is ready; the content stays behind
   * sign-in. Queueing failure rolls back the review so staff can retry.
   */
  async enqueueDataRightsResponse(user: { id: string; email: string; authVersion?: string | null }, requestId: string): Promise<void> {
    if (!this.configured) return;
    const tokenHash = digest(randomUUID()), purpose = 'data_rights_response';
    const payload = { from: this.sender.from, reply_to: this.sender.replyTo, to: [user.email], subject: 'Your Ujimora privacy request has a response',
      text: `We have responded to your privacy request (reference ${requestId}).\n\nFor your security the response is not included in this email. Sign in and open Settings, then "Your data and privacy requests", to read or download it:\n\n${this.sender.webUrl}/settings\n\nIf you did not make this request, contact ${this.sender.replyTo}.` };
    await AccountEmailJobModel.create({ userId: user.id, purpose, tokenHash, authVersion: user.authVersion ?? '', emailHash: digest(user.email), expiresAt: new Date(Date.now() + 24 * 3600_000), encryptedPayload: this.encrypt(payload, tokenHash, purpose) });
  }

  /** Called in the newsletter consent transaction. */
  async enqueueNewsletterConfirmation(subscriptionId: string, email: string, confirmToken: string, unsubscribeToken: string): Promise<void> {
    if (!this.configured) throw new Error('Newsletter confirmation email unavailable');
    const tokenHash = digest(confirmToken), purpose = 'newsletter_confirmation';
    const payload = { from: this.sender.from, reply_to: this.sender.replyTo, to: [email], subject: 'Confirm your Ujimora newsletter subscription',
      text: `You requested Ujimora stories and promotional updates. Confirm your subscription within 30 minutes:\n\n${this.sender.webUrl}/newsletter/confirm#token=${confirmToken}\n\nUntil you confirm, you will not receive newsletters. If you did not request this, ignore this message or cancel the request:\n${this.sender.webUrl}/newsletter/unsubscribe#token=${unsubscribeToken}\n\nYou can unsubscribe at any time. Contact ${this.sender.replyTo} for help or information about the source of your subscription request.` };
    await AccountEmailJobModel.create({ newsletterId: subscriptionId, purpose, tokenHash, emailHash: digest(email), expiresAt: new Date(Date.now() + 30 * 60_000), encryptedPayload: this.encrypt(payload, tokenHash, purpose) });
  }
}
