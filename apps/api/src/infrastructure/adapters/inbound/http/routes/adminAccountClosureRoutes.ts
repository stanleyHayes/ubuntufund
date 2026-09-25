import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { validate } from '../../middleware/validate.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import { logger } from '../../../../logging/logger.js';
import type { DeleteAccountUseCase } from '../../../../../application/use-cases/DeleteAccountUseCase.js';

const closeSchema = z.object({
  /** How staff verified the request came from the account holder (e.g. reply from the registered address). */
  verificationNote: z.string().trim().min(20).max(2000),
  /** Typed confirmation, so the wrong account cannot be closed by a mis-click. */
  confirmEmail: z.string().trim().min(3).max(320),
}).strict();

/**
 * Staff-assisted closure for account holders who cannot sign in (they are told
 * to email legal@). Uses the same erasure path as self-service deletion
 * (tombstone, retryable cleanup, token revocation) instead of database edits,
 * and records who closed the account and how the requester was verified.
 *
 * The audit row is written only after the closure succeeds, so a refusal
 * (money or payouts outstanding, account already gone) never leaves a record
 * saying an account was closed.
 */
export function createAdminAccountClosureRoutes(auth: RequestHandler, admin: RequestHandler, deleteAccount: DeleteAccountUseCase) {
  const router = Router();
  router.post('/:id/close', auth, admin, validate(closeSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id);
      if (!/^[a-f0-9]{24}$/i.test(id)) throw new AppError('Account not found', 404);
      if (id === req.userId) throw new AppError('Close your own account from your profile, not the staff console.', 409);
      const input = closeSchema.parse(req.body);
      await new MongoUnitOfWork().run(async () => {
        // Current-staff fence: a revoked or stale administrator session cannot close accounts.
        const staff = await UserModel.findOneAndUpdate({ _id: req.userId, role: 'admin', deletedAt: null,
          ...(req.authVersion ? { authVersion: req.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
        }, { $inc: { staffActionVersion: 1 } });
        if (!staff) throw new AppError('Current administrator access is required.', 403);
        const target = await UserModel.findOne({ _id: id, deletedAt: null }).select('email role');
        if (!target) throw new AppError('Account not found', 404);
        if (target.role === 'admin') throw new AppError('Administrator accounts cannot be closed from the console.', 409);
        if (String(target.email).toLowerCase() !== input.confirmEmail.toLowerCase()) {
          throw new AppError('The confirmation email does not match this account.', 400);
        }
      });
      // Staff verified the holder out of band, so there is no member password
      // step-up here; outstanding money or payouts still refuse with a 409.
      await deleteAccount.closeForStaff(id);
      const audit = { actorId: req.userId, actorRole: 'admin', action: 'account.staff_closure', resource: `user:${id}`,
        details: 'Staff-assisted account closure: account closed, sessions revoked and erasure started', reason: input.verificationNote,
        severity: 'warning', method: 'POST', path: '/admin/users/:id/close', statusCode: 200 };
      try {
        await AuditLogModel.create(audit);
      } catch (error) {
        // The account is already closed; a retry would only 404. Keep the
        // record in the error log so it can be restored to the audit trail.
        logger.error({ err: error, audit }, 'Staff account closure succeeded but its audit row was not saved');
      }
      res.json({ data: { closed: true } });
    } catch (error) { next(error); }
  });
  return router;
}
