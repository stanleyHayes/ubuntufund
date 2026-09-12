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

  async campaignPendingReview(input: {
    campaignId: string;
    title: string;
    goalAmount: number;
    currency: string;
    tier: number;
  }): Promise<void> {
    if (!this.apiKey || !this.from) return;

    let reviewerEmail = '';
    try {
      reviewerEmail = (await this.resolveReviewerEmail()).trim();
    } catch (error) {
      logger.warn({ err: error }, 'could not resolve the review alert recipient');
      return;
    }
    // Deliberately silent: an empty address is how an admin turns these off.
    if (!reviewerEmail) return;

    const goal = `${input.currency} ${input.goalAmount.toLocaleString('en-US')}`;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          // One alert per campaign, however many times this is retried.
          'Idempotency-Key': `campaign-review/${input.campaignId}`,
        },
        body: JSON.stringify({
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
        }),
      });
      if (!res.ok) {
        logger.warn(
          { status: res.status, campaignId: input.campaignId },
          'campaign review alert email failed'
        );
      }
    } catch (error) {
      logger.warn(
        { err: error, campaignId: input.campaignId },
        'campaign review alert email failed'
      );
    }
  }
}
