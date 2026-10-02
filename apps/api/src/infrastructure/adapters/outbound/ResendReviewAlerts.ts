import type { CampaignContentReviewReason } from '@ubuntu-fund/types';
import type { CampaignReviewQueueAlert, ReviewQueueAlertPort, ReviewQueueOccasion } from '../../../domain/ports/outbound/ReviewQueueAlertPort.js';
import { logger } from '../../logging/logger.js';
import { renderEmail } from './emailTemplate.js';

/** Why the content itself waits for a person, in the reviewer's words. */
const CONTENT_CHECK: Record<CampaignContentReviewReason, string> = {
  new_media: 'New photos or video to look at',
  no_screening_consent: 'The organizer did not opt in to automated screening',
  screening_flagged: 'Automated screening flagged the text',
  screening_unavailable: 'Automated screening was unavailable',
};

/** Why a campaign that already existed is back in the queue, for the email's opening line. */
const OCCASION_INTRO: Record<ReviewQueueOccasion['kind'], string> = {
  beneficiary_accepted: 'The beneficiary accepted this campaign. It now needs your approval before it can go live.',
  beneficiary_changed: 'The organizer changed who this campaign is for. It needs your approval before it can go live.',
  beneficiary_reassigned: 'Staff reassigned who this campaign is for. It needs your approval before it can go live.',
  returned_to_review: 'This campaign was returned to review. It needs a new decision before it can go live.',
};

/**
 * Tells the review team a campaign is waiting on them.
 *
 * A campaign above the auto-approve tier, or one whose new media or unscreened
 * text a person must check, sits in PENDING_REVIEW indefinitely, and until
 * now nothing said so — the organizer saw "Donations closed" and the
 * reviewer had to think to go and look. That is the failure mode worth email:
 * money that cannot be raised because nobody knew there was a queue.
 *
 * Its own adapter rather than a second method on the owner notifier, which
 * stamps every message with a `donation-owner/` idempotency key and honours the
 * recipient's *campaign-update* preferences. Neither applies here: this goes to
 * staff, not to a member who can unsubscribe from it.
 *
 * Never throws. Campaign creation has already succeeded by the time this runs,
 * and failing the request because an alert could not be sent would be strictly
 * worse than a missing email.
 */
export class ResendReviewAlerts implements ReviewQueueAlertPort {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    /**
     * Where reviewers read, resolved per alert rather than captured at boot.
     * It is admin-editable, so an address changed in the dashboard has to apply
     * to the next campaign — not after the next deploy. Empty disables alerts.
     */
    private readonly resolveReviewerEmail: () => Promise<string>,
    private readonly adminUrl: string,
    /** The web app origin, which serves the logo the email template shows. */
    private readonly webUrl = 'https://app.ujimora.com',
  ) {}

  /**
   * A public contact-form message. Before this the only staff signal was a
   * count in the admin action centre, while the site promised a reply. Replies
   * go straight to the sender. Same recipient and never-throw rules as the
   * campaign review alert.
   */
  async contactReceived(input: {
    id: string;
    name: string;
    email: string;
    subject: string;
    inquiryType: string;
    message: string;
  }): Promise<void> {
    const to = await this.recipient();
    if (!to) return;
    const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();
    const name = oneLine(input.name);
    await this.send(`contact-staff/${input.id}`, {
      from: this.from,
      to: [to],
      reply_to: input.email,
      subject: `New contact message — ${oneLine(input.subject).slice(0, 150)}`,
      ...renderEmail({
        preheader: `${name} wrote about “${oneLine(input.subject)}”.`,
        eyebrow: 'Contact message',
        heading: `New message from ${name}`,
        details: [
          { label: 'From', value: `${name} <${input.email}>` },
          { label: 'Type', value: input.inquiryType },
          { label: 'Subject', value: oneLine(input.subject) },
        ],
        message: { body: input.message },
        button: { label: 'Open contact messages', url: `${this.adminUrl}/contact-submissions` },
        after: ['Reply to this email to answer the sender directly.'],
        footer: ['Sent to the team address set in Admin → Settings.'],
      }, { webUrl: this.webUrl }),
    }, { contactSubmissionId: input.id }, 'contact alert email failed');
  }

  private async recipient(): Promise<string> {
    if (!this.apiKey || !this.from) return '';
    try {
      return (await this.resolveReviewerEmail()).trim();
    } catch (error) {
      logger.warn({ err: error }, 'could not resolve the review alert recipient');
      return '';
    }
  }

  private async send(idempotencyKey: string, body: Record<string, unknown>, context: Record<string, unknown>, failure: string): Promise<void> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
      if (!res.ok) logger.warn({ status: res.status, ...context }, failure);
    } catch (error) {
      logger.warn({ err: error, ...context }, failure);
    }
  }

  async campaignPendingReview(input: CampaignReviewQueueAlert): Promise<void> {
    // Deliberately silent when empty: an empty address is how an admin turns these off.
    const reviewerEmail = await this.recipient();
    if (!reviewerEmail) return;

    const goal = `${input.currency} ${input.goalAmount.toLocaleString('en-US')}`;
    // One alert per campaign and occasion, however many times this is retried.
    // A campaign that comes back to the queue later (its beneficiary accepted,
    // was changed or reassigned, or staff returned it to review) is a new
    // occasion with its own key, so the provider does not drop it as a duplicate.
    const key = input.occasion ? `campaign-review/${input.campaignId}/${input.occasion.kind}/${input.occasion.ref}` : `campaign-review/${input.campaignId}`;
    await this.send(key, {
      from: this.from,
      to: [reviewerEmail],
      subject: `Campaign awaiting review — ${input.title} (${goal})`,
      ...renderEmail({
        preheader: `“${input.title}” needs approval before it can accept donations.`,
        eyebrow: 'Review queue',
        heading: 'A campaign is waiting for review',
        intro: [input.occasion ? OCCASION_INTRO[input.occasion.kind] : `A tier ${input.tier} campaign needs approval before it can accept donations. It is not visible to donors until it is approved.`],
        details: [
          { label: 'Title', value: input.title },
          { label: 'Goal', value: goal },
          ...(input.contentReviewReason ? [{ label: 'Content check', value: CONTENT_CHECK[input.contentReviewReason] }] : []),
          ...(input.contentReviewTrigger === 'beneficiary_change' ? [{ label: 'What changed', value: 'The beneficiary’s name and reason' }] : []),
        ],
        button: { label: 'Review it', url: `${this.adminUrl}/campaigns/${input.campaignId}` },
        footer: ['Sent to the team address set in Admin → Settings.'],
      }, { webUrl: this.webUrl }),
    }, { campaignId: input.campaignId }, 'campaign review alert email failed');
  }
}
