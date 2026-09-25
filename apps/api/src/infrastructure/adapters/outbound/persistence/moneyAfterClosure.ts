import { AccountDeletionRequestModel } from '../../../database/models/AccountDeletionRequestModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { logger } from '../../../logging/logger.js';

/**
 * Money that settled for an account after it was closed (for example a wallet
 * top-up confirmed by a late webhook or the reconciliation sweep). The credit
 * itself stands — the ledger must match what the processor collected — but
 * the holder can no longer sign in to withdraw it, so it must not arrive
 * silently: the closure's deletion request goes back to the top of the staff
 * privacy queue as review_required with a system note, and an error is logged.
 *
 * Staff notes are kept (the note is appended) and the revision is bumped so a
 * review form opened before the money arrived cannot be saved over it. Never
 * throws: flagging must not undo or fail a settlement that already committed.
 */
export async function flagMoneyAfterClosure(userId: string, note: string): Promise<boolean> {
  try {
    if (!(await UserModel.exists({ _id: userId, deletedAt: { $ne: null } }))) return false;
    logger.error({ userId, note }, 'Money settled for a closed account; flagged for staff review');
    const line = `[system ${new Date().toISOString()}] ${note}`;
    await AccountDeletionRequestModel.updateOne({ userId }, [{ $set: {
      status: 'review_required',
      nextReviewAt: '$$NOW',
      revision: { $add: [{ $ifNull: ['$revision', 0] }, 1] },
      reviewNotes: { $trim: { input: { $concat: [{ $ifNull: ['$reviewNotes', ''] }, '\n', { $literal: line }] } } },
    } }]);
    return true;
  } catch (error) {
    logger.error({ err: error, userId, note }, 'Could not flag money that settled for a closed account');
    return false;
  }
}
