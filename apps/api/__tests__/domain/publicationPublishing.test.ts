import { describe, expect, it } from 'vitest';
import {
  AUTO_PUBLISH_ACTIONS, CREATE_ACTIONS, PUBLICATION_ACTIONS, PUBLICATION_OUTCOME_REASONS, SINGLE_ITEM_ACTIONS,
  canWithdrawPublication, isAutoPublishAction, publicationNextStep, publicationOutcomeCopy, publicationReasonCopy,
} from '@ubuntu-fund/types';
import {
  HELD_MESSAGE, HELD_MESSAGE_PREFIX, HELD_PUBLISHES_ON_APPROVAL_MESSAGE, PUBLICATION_FENCE_CODES, PublicationAlreadyPublished,
  isPublicationHeldError, publicationFenceOutcome, publicationHeld,
} from '../../src/infrastructure/adapters/inbound/middleware/publicationErrors.js';
import { AppError } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';

describe('publish-on-approval actions', () => {
  it('covers the eight owner-approved actions and never live sessions or campaign proposals', () => {
    expect([...AUTO_PUBLISH_ACTIONS].sort()).toEqual(['account.profile', 'campaign.slug', 'comment.create', 'creator.profile', 'organization.profile', 'thank_you.send', 'update.create', 'update.edit']);
    expect(isAutoPublishAction('live.start')).toBe(false);
    expect(isAutoPublishAction('campaign.create')).toBe(false);
    expect(isAutoPublishAction('constructor')).toBe(false);
    for (const action of [...CREATE_ACTIONS, ...SINGLE_ITEM_ACTIONS]) expect(AUTO_PUBLISH_ACTIONS).toContain(action);
    for (const action of AUTO_PUBLISH_ACTIONS) expect(PUBLICATION_ACTIONS).toContain(action);
  });
});

describe('publicationOutcomeCopy', () => {
  it('has words for every reason, and a generic sentence for one it does not know', () => {
    for (const reason of PUBLICATION_OUTCOME_REASONS) {
      const copy = publicationReasonCopy(reason);
      expect(copy.author, reason).toMatch(/^[A-Z].*\.$/);
      expect(copy.staff, reason).toMatch(/^[a-z][^.]*$/);
      expect(['same_version', 'new_version', 'none']).toContain(copy.resubmit);
    }
    expect(publicationReasonCopy('reason_from_a_newer_api')).toMatchObject({ author: "It couldn't be published.", resubmit: 'new_version' });
    expect(publicationReasonCopy(undefined).author).toBe("It couldn't be published.");
  });

  it('titles notices per action, in the form\'s own words', () => {
    expect(publicationOutcomeCopy({ action: 'comment.create', state: 'published' })).toMatchObject({ title: 'Your comment is live', body: 'Approved and posted on the campaign.' });
    expect(publicationOutcomeCopy({ action: 'thank_you.send', state: 'published' })).toMatchObject({ title: 'Your thank-you message was approved', body: "Approved; we're emailing your donors and will send you a delivery summary." });
    expect(publicationOutcomeCopy({ action: 'organization.profile', state: 'published' }).title).toBe('Your organization details are live');
    expect(publicationOutcomeCopy({ action: 'organization.profile', state: 'not_published', reason: 'restricted' }).title).toBe("Your organization details weren't published");
    expect(publicationOutcomeCopy({ action: 'campaign.slug', state: 'declined' })).toMatchObject({ title: "Your campaign link wasn't approved", body: "Read the reviewer's note in Publication reviews." });
  });

  it('gives the reason and the next step when a version was not published', () => {
    const copy = publicationOutcomeCopy({ action: 'account.profile', state: 'not_published', reason: 'credentials_changed', deadline: '7 Oct, 14:00' });
    expect(copy).toMatchObject({
      title: "Your profile wasn't published",
      body: 'Your sign-in details changed since you submitted it (a password or two-step verification change). Save it again before 7 Oct, 14:00 to publish it straight away.',
      staff: "Not published: the author's password or two-step verification changed after they submitted it",
      resubmit: 'same_version',
    });
    expect(publicationOutcomeCopy({ action: 'comment.create', state: 'not_published', reason: 'blocked' }).body).toBe('You can no longer post on this campaign.');
  });

  it('explains a replaced, withdrawn or manually approved version', () => {
    expect(publicationOutcomeCopy({ action: 'update.edit', state: 'superseded', reason: 'edited_since_submitted' })).toMatchObject({
      title: "Your earlier edited campaign update wasn't published",
      body: "It changed after you submitted it, so this version wasn't published. Submit your latest version if it still needs review.",
      staff: 'Not published: the author changed it after submitting',
    });
    expect(publicationOutcomeCopy({ action: 'creator.profile', state: 'superseded', reason: 'newer_version_submitted' })).toMatchObject({ body: 'You (or your team) submitted a newer version.', staff: 'Replaced by a newer version' });
    expect(publicationOutcomeCopy({ action: 'comment.create', state: 'withdrawn' })).toMatchObject({ body: "You withdrew it. It won't be published.", staff: 'Withdrawn by the author' });
    expect(publicationOutcomeCopy({ action: 'live.start', state: 'approved', deadline: '7 Oct' }).body).toBe('Approved. Start the session again with the same title and goal before 7 Oct.');
    expect(publicationOutcomeCopy({ action: 'comment.create', state: 'approved', deadline: '7 Oct' }).body).toBe('Approved. Post it again unchanged before 7 Oct to publish it.');
  });

  it('never throws on an action or state it does not know', () => {
    expect(publicationOutcomeCopy({ action: 'future.action', state: 'published' }).title).toBe('Your change is live');
    expect(publicationOutcomeCopy({ action: 'toString', state: 'something_new' }).title).toBe("Your change wasn't published");
    expect(publicationNextStep('comment.create', 'none')).toBe('');
  });
});

describe('canWithdrawPublication', () => {
  it('allows waiting and approved-but-unpublished versions of the publish-on-approval actions only', () => {
    expect(canWithdrawPublication({ action: 'comment.create', status: 'pending' })).toBe(true);
    for (const publishState of ['queued', 'applying', 'not_published']) expect(canWithdrawPublication({ action: 'update.edit', status: 'approved', publishState })).toBe(true);
    for (const publishState of [undefined, 'published', 'superseded', 'withdrawn']) expect(canWithdrawPublication({ action: 'update.edit', status: 'approved', publishState })).toBe(false);
    for (const status of ['rejected', 'superseded', 'withdrawn']) expect(canWithdrawPublication({ action: 'comment.create', status })).toBe(false);
    expect(canWithdrawPublication({ action: 'live.start', status: 'pending' })).toBe(false);
    expect(canWithdrawPublication({ action: 'campaign.create', status: 'pending' })).toBe(false);
  });
});

describe('publication errors', () => {
  it('marks a hold that publishes on approval and keeps the prefix older clients detect', () => {
    const automatic = publicationHeld(true);
    expect(automatic).toMatchObject({ statusCode: 409, message: HELD_PUBLISHES_ON_APPROVAL_MESSAGE, errors: { publication: ['held', 'publishes_on_approval'] } });
    expect(publicationHeld(false)).toMatchObject({ statusCode: 409, message: HELD_MESSAGE, errors: { publication: ['held'] } });
    for (const message of [HELD_MESSAGE, HELD_PUBLISHES_ON_APPROVAL_MESSAGE]) expect(message.startsWith(HELD_MESSAGE_PREFIX)).toBe(true);
    expect(publicationHeld(true, { saved: ['private'] }).errors).toEqual({ saved: ['private'], publication: ['held', 'publishes_on_approval'] });
    expect(isPublicationHeldError(automatic)).toBe(true);
    expect(isPublicationHeldError(new PublicationAlreadyPublished('x'))).toBe(false);
    expect(isPublicationHeldError(new AppError('Saved privately for safety review.', 409))).toBe(false);
  });

  it('reports an already published version without the held marker', () => {
    const error = new PublicationAlreadyPublished('64b000000000000000000009');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ name: 'AppError', statusCode: 409, resourceId: '64b000000000000000000009', message: 'This version is already published.', errors: { publication: ['published'] } });
    expect(error.message.startsWith(HELD_MESSAGE_PREFIX)).toBe(false);
  });

  it('maps every fence code to an expected outcome', () => {
    for (const code of PUBLICATION_FENCE_CODES) expect(PUBLICATION_OUTCOME_REASONS).toContain(publicationFenceOutcome(code).reason);
    expect(publicationFenceOutcome('stale_version')).toEqual({ state: 'superseded', reason: 'edited_since_submitted' });
    expect(publicationFenceOutcome('terms_required')).toEqual({ state: 'not_published', reason: 'terms_not_accepted' });
  });
});
