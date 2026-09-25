import { createHash } from 'node:crypto';
import type { VerificationType } from '@ubuntu-fund/types';
import { NotificationModel } from '../../../database/models/NotificationModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import type { StaffDecisionNoticeInput, StaffDecisionNotifierPort } from '../../../../domain/ports/outbound/StaffDecisionNotifierPort.js';

export type StaffDecisionNotice = StaffDecisionNoticeInput;

// Same support address the moderation errors in authMiddleware point to.
const SUPPORT = 'support@ujimora.com';

/**
 * In-app service notice telling a user about a staff decision on their own
 * campaign, verification or report. Inbox only; no email is sent.
 *
 * The notification id is derived from `key`, so a retried request (or a
 * retried transaction callback) upserts the same row instead of adding a
 * duplicate, and never resets its read state. Called inside a
 * MongoUnitOfWork, the notice commits or rolls back with the decision.
 */
export async function recordStaffDecisionNotice(notice: StaffDecisionNotice): Promise<void> {
  if (!notice.userId || !/^[a-f0-9]{24}$/i.test(notice.userId)) return; // Guests have no inbox.
  if (!(await UserModel.exists({ _id: notice.userId, deletedAt: null }))) return;
  const id = createHash('sha256').update(`staff-decision:${notice.key}`).digest('hex').slice(0, 24);
  await NotificationModel.updateOne({ _id: id }, {
    $setOnInsert: { userId: notice.userId, title: notice.title, body: notice.body, path: notice.path, type: 'staff_decision', read: false },
  }, { upsert: true });
}

/** Port adapter for application use cases. */
export class MongoStaffDecisionNotifier implements StaffDecisionNotifierPort {
  notify(notice: StaffDecisionNoticeInput): Promise<void> {
    return recordStaffDecisionNotice(notice);
  }
}

/**
 * Campaign review outcome for the organizer. Staff decision notes are written
 * for the internal review record, so they are deliberately not copied here.
 */
export function campaignDecisionNotice(input: { campaignId: string; title: string; ownerId: string; version: string; action: 'approve' | 'reject' | 'block' | 'reopen' }): StaffDecisionNotice {
  const name = `“${input.title}”`;
  const base = { key: `campaign-review:${input.campaignId}:${input.version}:${input.action}`, userId: input.ownerId };
  switch (input.action) {
    case 'approve':
      return { ...base, title: 'Your campaign is live', body: `${name} passed review and is now public.`, path: `/campaigns/${input.campaignId}` };
    case 'reject':
      return { ...base, title: 'Your campaign was not approved', body: `${name} did not pass review and is not public. For details or to ask for another review, contact ${SUPPORT}.`, path: '/my-campaigns' };
    case 'block':
      return { ...base, title: 'Your campaign has been blocked', body: `${name} was removed from public view after a review. For details or to appeal, contact ${SUPPORT}.`, path: '/my-campaigns' };
    case 'reopen':
      return { ...base, title: 'Your campaign is back in review', body: `${name} has returned to the review queue. We will let you know the outcome.`, path: '/my-campaigns' };
  }
}

const VERIFICATION_LABELS: Record<VerificationType, string> = {
  identity: 'identity', address: 'address', business: 'organization', political: 'political', media: 'media',
};

/** Verification decision for the applicant. The rejection reason is already applicant-facing. */
export function kycDecisionNotice(input: { kycId: string; userId: string; verificationType: VerificationType; version: string; decision: 'approved' | 'rejected' | 'information_requested'; rejectionReason?: string }): StaffDecisionNotice {
  const label = VERIFICATION_LABELS[input.verificationType] ?? 'verification';
  const base = { key: `kyc:${input.kycId}:${input.decision}:${input.version}`, userId: input.userId, path: '/kyc' };
  if (input.decision === 'approved') {
    return { ...base, title: `Your ${label} verification is approved`, body: `Our review team approved your ${label} verification.` };
  }
  if (input.decision === 'rejected') {
    return { ...base, title: `Your ${label} verification was not approved`, body: `${input.rejectionReason ? `Reason: ${input.rejectionReason}\n` : ''}You can review the details and submit again from your verification page.` };
  }
  return { ...base, title: 'More information needed for your verification', body: `Our review team needs more information to finish reviewing your ${label} verification. Open your verification page to read the request and reply.` };
}

const HIDING_ACTIONS: Record<string, { title: string; body: string }> = {
  hide_comment: { title: 'Your comment was removed', body: 'A comment you posted was removed after a safety review.' },
  hide_update: { title: 'Your campaign update was removed', body: 'A campaign update you posted was removed after a safety review.' },
  hide_message: { title: 'Your message was hidden', body: 'A message you left with a payment was hidden after a safety review. The payment itself is not affected.' },
  stop_live: { title: 'Your live broadcast was stopped', body: 'Your live broadcast was stopped after a safety review.' },
  restrict_user: { title: 'Publishing is restricted on your account', body: 'After a safety review, publishing from your account is restricted. Your account settings and funds remain accessible.' },
};

/**
 * Safety-report outcome: a neutral acknowledgement to the reporter, and a notice
 * to the reported user only when an action was taken against their content.
 * Staff review notes are never included.
 */
export function safetyReportNotices(input: { reportId: string; reporterId?: string; targetUserId?: string; action: string }): StaffDecisionNotice[] {
  const notices: StaffDecisionNotice[] = [{
    key: `safety-report:${input.reportId}:reporter`, userId: input.reporterId,
    title: 'We reviewed your report', body: 'Thank you for your report. Our team has reviewed it and taken the action it considers appropriate.',
  }];
  const taken = HIDING_ACTIONS[input.action];
  if (taken && input.targetUserId && input.targetUserId !== input.reporterId) {
    notices.push({ key: `safety-report:${input.reportId}:target`, userId: input.targetUserId, title: taken.title, body: `${taken.body} For details or to appeal, contact ${SUPPORT}.` });
  }
  return notices;
}
