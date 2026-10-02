import { describe, expect, it } from 'vitest';
import {
  PUBLICATION_REVIEWS_PATH, formatPublicationDeadline, publicationNotice, publishedNoticePath,
} from '../../../src/infrastructure/adapters/outbound/persistence/publicationNotices.js';
import { publicationProgressOf } from '../../../src/infrastructure/adapters/outbound/persistence/MongoPublicationApplyStore.js';

const reviewedAt = new Date('2026-10-02T09:00:00.000Z');
const now = new Date('2026-10-02T10:00:00.000Z');
const expires = new Date('2026-10-09T14:05:00.000Z');

describe('publication notices', () => {
  it('formats deadlines in Ghana time', () => {
    expect(formatPublicationDeadline(expires)).toBe('9 Oct 2026, 14:05 GMT');
  });

  it('keys a decision and each outcome once per decision, without content', () => {
    const base = { reviewId: 'review-1', actorId: 'author-1', action: 'comment.create', reviewedAt, now };
    expect(publicationNotice({ ...base, state: 'declined' })).toEqual({
      key: `publication-review:review-1:${reviewedAt.getTime()}:decision`, userId: 'author-1',
      title: "Your comment wasn't approved", body: "Read the reviewer's note in Publication reviews.", path: PUBLICATION_REVIEWS_PATH,
    });
    expect(publicationNotice({ ...base, state: 'approved', approvalExpiresAt: expires })).toMatchObject({
      key: `publication-review:review-1:${reviewedAt.getTime()}:decision`,
      title: 'Your comment was approved', body: 'Approved. Post it again unchanged before 9 Oct 2026, 14:05 GMT to publish it.',
    });
    expect(publicationNotice({ ...base, state: 'published', path: '/campaigns/c1' })).toMatchObject({
      key: `publication-review:review-1:${reviewedAt.getTime()}:published`, title: 'Your comment is live', path: '/campaigns/c1',
    });
    // The deadline only while it lasts.
    expect(publicationNotice({ ...base, state: 'not_published', reason: 'credentials_changed', approvalExpiresAt: expires }).body)
      .toBe('Your sign-in details changed since you submitted it (a password or two-step verification change). Post it again before 9 Oct 2026, 14:05 GMT to publish it straight away.');
    expect(publicationNotice({ ...base, state: 'not_published', reason: 'credentials_changed', approvalExpiresAt: new Date(now.getTime() - 1) }).body)
      .toBe('Your sign-in details changed since you submitted it (a password or two-step verification change). Post it again to publish it.');
    expect(publicationNotice({ ...base, state: 'superseded', reason: 'edited_since_submitted' })).toMatchObject({
      key: `publication-review:review-1:${reviewedAt.getTime()}:superseded`, title: "Your earlier comment wasn't published",
    });
  });

  it('links a published notice to where the change shows', () => {
    expect(publishedNoticePath('comment.create', 'c1')).toBe('/campaigns/c1');
    expect(publishedNoticePath('update.create', 'c1')).toBe('/campaigns/c1');
    expect(publishedNoticePath('campaign.slug', 'c1')).toBe('/campaigns/c1');
    expect(publishedNoticePath('thank_you.send', 'c1')).toBe('/campaigns/c1/thank-you');
    expect(publishedNoticePath('account.profile', 'u1')).toBe('/profile');
    expect(publishedNoticePath('organization.profile', 'o1')).toBe('/organization-team');
    expect(publishedNoticePath('creator.profile', 'u1')).toBe('/creator');
    // Only its handler knows an edited update's campaign.
    expect(publishedNoticePath('update.edit', 'update-1')).toBe(PUBLICATION_REVIEWS_PATH);
  });
});

describe('publicationProgressOf', () => {
  const at = new Date('2026-10-01T00:00:00.000Z');
  it('reads queued and running attempts as publishing, and closed versions as their own state', () => {
    expect(publicationProgressOf({ status: 'approved', publishState: 'queued', publishStateAt: at })).toEqual({ state: 'publishing', at });
    expect(publicationProgressOf({ status: 'approved', publishState: 'applying', publishStateAt: at, publishReason: 'unavailable' })).toEqual({ state: 'publishing', at });
    expect(publicationProgressOf({ status: 'approved', publishState: 'published', publishStateAt: at })).toEqual({ state: 'published', at });
    expect(publicationProgressOf({ status: 'approved', publishState: 'not_published', publishReason: 'restricted', publishStateAt: at })).toEqual({ state: 'not_published', reason: 'restricted', at });
    expect(publicationProgressOf({ status: 'superseded', closedAt: at })).toEqual({ state: 'superseded', reason: 'newer_version_submitted', at });
    expect(publicationProgressOf({ status: 'withdrawn', closedAt: at })).toEqual({ state: 'withdrawn', reason: 'withdrawn_by_author', at });
  });

  it('has nothing to say about other versions, and drops an unknown reason', () => {
    for (const row of [{ status: 'pending' }, { status: 'rejected' }, { status: 'approved' }, { status: 'approved', publishState: 'unknown' }]) {
      expect(publicationProgressOf(row)).toBeNull();
    }
    expect(publicationProgressOf({ status: 'approved', publishState: 'not_published', publishReason: 'made_up' })).toEqual({ state: 'not_published' });
  });
});
