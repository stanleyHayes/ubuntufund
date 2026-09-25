import { logger } from '../../logging/logger.js';

/**
 * Tells the review team a campaign is waiting on them.
 *
 * A campaign above the auto-approve tier sits in PENDING_REVIEW indefinitely,
 * and until now nothing said so — the organizer saw "Donations closed" and the
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
export class ResendReviewAlerts {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    /**
     * Where reviewers read, resolved per alert rather than captured at boot.
     * It is admin-editable, so an address changed in the dashboard has to apply
     * to the next campaign — not after the next deploy. Empty disables alerts.
     */
    private readonly resolveReviewerEmail: () => Promise<string>,
    private readonly adminUrl: string
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
    await this.send(`contact-staff/${input.id}`, {
      from: this.from,
      to: [to],
      reply_to: input.email,
      subject: `New contact message — ${oneLine(input.subject).slice(0, 150)}`,
      text: [
        `From:     ${oneLine(input.name)} <${input.email}>`,
        `Type:     ${input.inquiryType}`,
        `Subject:  ${oneLine(input.subject)}`,
        '',
        input.message,
        '',
        'Reply to this email to answer the sender directly.',
        `Triage it: ${this.adminUrl}/contact-submissions`,
      ].join('\n'),
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

  async campaignPendingReview(input: {
    campaignId: string;
    title: string;
    goalAmount: number;
    currency: string;
    tier: number;
  }): Promise<void> {
    // Deliberately silent when empty: an empty address is how an admin turns these off.
    const reviewerEmail = await this.recipient();
    if (!reviewerEmail) return;

    const goal = `${input.currency} ${input.goalAmount.toLocaleString('en-US')}`;
    // One alert per campaign, however many times this is retried.
    await this.send(`campaign-review/${input.campaignId}`, {
      from: this.from,
      to: [reviewerEmail],
      subject: `Campaign awaiting review — ${input.title} (${goal})`,
      text: [
        `A tier ${input.tier} campaign needs approval before it can accept donations.`,
        '',
        `Title:  ${input.title}`,
        `Goal:   ${goal}`,
        '',
        'It is not visible to donors until it is approved.',
        '',
        `Review it: ${this.adminUrl}/campaigns/${input.campaignId}`,
      ].join('\n'),
    }, { campaignId: input.campaignId }, 'campaign review alert email failed');
  }
}
