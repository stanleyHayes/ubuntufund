import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { UserEntity } from '../../../domain/entities/User.js';
import type { ActivityEmailSender } from './persistence/MongoActivityAlerts.js';
import { AccountEmailJobModel } from '../../database/models/AccountEmailJobModel.js';
import { PasswordResetTokenModel } from '../../database/models/PasswordResetTokenModel.js';
import { EmailVerificationTokenModel } from '../../database/models/EmailVerificationTokenModel.js';
import { UserModel } from '../../database/models/UserModel.js';
import { NewsletterSubscriptionModel } from '../../database/models/NewsletterSubscriptionModel.js';
import { NewsletterConsentTokenModel } from '../../database/models/NewsletterConsentTokenModel.js';
import { CampaignBeneficiaryInvitationModel } from '../../database/models/CampaignBeneficiaryInvitationModel.js';
import { MongoUnitOfWork } from './persistence/MongoUnitOfWork.js';
import { renderEmail, type EmailContent } from './emailTemplate.js';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** A short-lived encrypted outbox. Raw recovery links never enter logs or API responses. */
export class AccountEmails {
  readonly configured: boolean;
  constructor(private readonly sender: ActivityEmailSender, private readonly key: Buffer | null) {
    let secureOrigin = false;
    try { const url = new URL(sender.webUrl); secureOrigin = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash; } catch { /* unavailable */ }
    this.configured = sender.configured && key?.length === 32 && secureOrigin;
  }
  /** The sender envelope plus the branded HTML and matching plain-text parts. */
  private message(to: string, subject: string, content: EmailContent): Record<string, unknown> {
    return { from: this.sender.from, reply_to: this.sender.replyTo, to: [to], subject, ...renderEmail(content, { webUrl: this.sender.webUrl, supportEmail: this.sender.replyTo }) };
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
    const payload = purpose === 'verification'
      ? this.message(user.email.value, 'Verify your Ujimora email address', {
        preheader: 'Confirm this address to finish setting up your Ujimora account.',
        eyebrow: 'Your account',
        heading: 'Confirm your email address',
        intro: ['Confirm that this email address belongs to you. It lets you receive receipts and account notices, and keeps your account recoverable.'],
        button: { label: 'Verify my email', url: link },
        showLinkFallback: true,
        after: ['This link expires in 30 minutes and can be used once. Verification does not subscribe you to activity or marketing emails.'],
        footer: ['You received this because this address was entered on Ujimora. If that was not you, you can ignore this email.'],
      })
      : this.message(user.email.value, 'Reset your Ujimora password', {
        preheader: 'Choose a new password for your Ujimora account.',
        eyebrow: 'Account security',
        heading: 'Reset your password',
        intro: ['You asked to reset your Ujimora password. Choose a new one with the button below.'],
        button: { label: 'Choose a new password', url: link },
        showLinkFallback: true,
        after: ['This link expires in 30 minutes and can be used once.'],
        footer: ['If you did not ask for this, ignore this email. Your password has not changed.'],
      });
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
        if (job.purpose === 'beneficiary_invitation') {
          // A resend, reassignment, decision or expiry makes the old link useless: never send it.
          eligible = !!(await CampaignBeneficiaryInvitationModel.exists({ _id: job.invitationId, tokenHash: job.tokenHash, emailHash: job.emailHash, status: 'pending', expiresAt: { $gt: new Date() } }));
        } else if (job.purpose === 'newsletter_confirmation') {
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
    const payload = this.message(user.email.value, 'Your Ujimora password changed', {
      preheader: 'Your password was changed and your other sessions were signed out.',
      eyebrow: 'Account security',
      heading: 'Your password was changed',
      intro: ['Your Ujimora password was changed and your previous sessions have ended.', 'If you made this change, you do not need to do anything.'],
      button: { label: 'I didn’t do this: reset my password', url: `${this.sender.webUrl}/forgot-password` },
      after: [`If you did not change it, reset your password now and contact ${this.sender.replyTo}.`],
      footer: ['This is an account security notice, not a marketing subscription.'],
    });
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
    const payload = this.message(user.email, 'Your Ujimora privacy request has a response', {
      preheader: 'Sign in to read the response to your privacy request.',
      eyebrow: 'Your privacy request',
      heading: 'We have responded to your request',
      intro: ['For your security the response is not included in this email. Sign in and open Settings, then “Your data and privacy requests”, to read or download it.'],
      details: [{ label: 'Reference', value: requestId }],
      button: { label: 'Open Settings', url: `${this.sender.webUrl}/settings` },
      after: [`If you did not make this request, contact ${this.sender.replyTo}.`],
      footer: ['This is a notice about a request you made, not a marketing subscription.'],
    });
    await AccountEmailJobModel.create({ userId: user.id, purpose, tokenHash, authVersion: user.authVersion ?? '', emailHash: digest(user.email), expiresAt: new Date(Date.now() + 24 * 3600_000), encryptedPayload: this.encrypt(payload, tokenHash, purpose) });
  }

  /**
   * Called inside the transaction that creates or re-sends a beneficiary
   * invitation, so the email is queued only if the invitation commits. The
   * token appears only in this encrypted payload and the recipient's inbox.
   */
  async enqueueBeneficiaryInvitation(input: {
    invitationId: string; email: string; token: string; expiresAt: Date;
    organizerName: string; campaignTitle: string; beneficiaryName: string;
    payoutArrangement: 'beneficiary' | 'organization'; publicationRequiresConsent: boolean;
  }): Promise<void> {
    if (!this.configured) throw new Error('Beneficiary invitation email unavailable');
    const tokenHash = digest(input.token), purpose = 'beneficiary_invitation';
    const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();
    const organizer = oneLine(input.organizerName), title = oneLine(input.campaignTitle);
    const expires = input.expiresAt.toUTCString().replace(/ GMT$/, ' GMT');
    const payout = input.payoutArrangement === 'beneficiary'
      ? 'Funds raised would be paid to you, into your own verified payout account.'
      : `Funds raised would be paid to ${organizer}, who asks to receive them on your behalf. Only accept this if you agree to it.`;
    const gate = input.publicationRequiresConsent ? 'It will not go live, collect donations or pay out money' : 'It will not collect donations or pay out money';
    const beneficiary = oneLine(input.beneficiaryName);
    const payload = this.message(input.email, `${organizer} created a fundraising campaign for you on Ujimora`.slice(0, 150), {
      preheader: `${gate} until you review it and accept.`,
      eyebrow: 'Campaign invitation',
      heading: `${organizer} created a fundraising campaign for you`,
      intro: [`${organizer} has created a fundraising campaign on Ujimora for ${beneficiary}. ${gate} until you review it and accept.`],
      details: [{ label: 'Campaign', value: title }, { label: 'For', value: beneficiary }, { label: 'Organized by', value: organizer }],
      button: { label: 'Review, accept or decline', url: `${this.sender.webUrl}/beneficiary-invitation#token=${input.token}` },
      showLinkFallback: true,
      after: [payout, `This link expires on ${expires} and works once. Do not share it: whoever opens it can accept or decline for you.`],
      footer: ['If you do not recognise this, you can decline or ignore this email.'],
    });
    await AccountEmailJobModel.create({ invitationId: input.invitationId, purpose, tokenHash, emailHash: digest(input.email.trim().toLowerCase()), expiresAt: input.expiresAt, encryptedPayload: this.encrypt(payload, tokenHash, purpose) });
  }

  /** Called in the newsletter consent transaction. */
  async enqueueNewsletterConfirmation(subscriptionId: string, email: string, confirmToken: string, unsubscribeToken: string): Promise<void> {
    if (!this.configured) throw new Error('Newsletter confirmation email unavailable');
    const tokenHash = digest(confirmToken), purpose = 'newsletter_confirmation';
    const payload = this.message(email, 'Confirm your Ujimora newsletter subscription', {
      preheader: 'Confirm within 30 minutes to start receiving Ujimora stories.',
      eyebrow: 'Newsletter',
      heading: 'Confirm your subscription',
      intro: ['You asked to receive Ujimora stories and promotional updates. Until you confirm, you will not receive newsletters.'],
      button: { label: 'Confirm my subscription', url: `${this.sender.webUrl}/newsletter/confirm#token=${confirmToken}` },
      showLinkFallback: true,
      after: ['This link expires in 30 minutes. You can unsubscribe at any time.'],
      footer: [`If you did not request this, ignore this message or cancel the request. Contact ${this.sender.replyTo} for help or information about the source of your subscription request.`],
      footerLinks: [{ label: 'Cancel this request', url: `${this.sender.webUrl}/newsletter/unsubscribe#token=${unsubscribeToken}` }],
    });
    await AccountEmailJobModel.create({ newsletterId: subscriptionId, purpose, tokenHash, emailHash: digest(email), expiresAt: new Date(Date.now() + 30 * 60_000), encryptedPayload: this.encrypt(payload, tokenHash, purpose) });
  }
}
