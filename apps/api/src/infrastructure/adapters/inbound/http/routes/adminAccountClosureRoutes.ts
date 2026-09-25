import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { validate } from '../../middleware/validate.js';
import { clientIp } from '../../middleware/clientIp.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { logger } from '../../../../logging/logger.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import {
  describeClosureBlockersForStaff,
  type DeleteAccountUseCase,
} from '../../../../../application/use-cases/DeleteAccountUseCase.js';

const closeSchema = z.object({
  /** How staff verified the request came from the account holder (e.g. reply from the registered address). */
  verificationNote: z.string().trim().min(20).max(2000),
  /** Typed confirmation, so the wrong account cannot be closed by a mis-click. */
  confirmEmail: z.string().trim().min(3).max(320),
}).strict();

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Staff-assisted closure for account holders who cannot sign in (they are told
 * to email legal@). Uses the same erasure path as self-service deletion
 * (tombstone, retryable cleanup, token revocation) instead of database edits,
 * and records who closed the account and how the requester was verified.
 *
 * The holder is never asked for a password or code, so this goes through
 * DeleteAccountUseCase.closeByStaff (no step-up). Balances and in-flight
 * payouts still block closure: staff see them before confirming (GET
 * /:id/closure), and a refused attempt is audited as refused, never as closed.
 */
export function createAdminAccountClosureRoutes(
  auth: RequestHandler,
  admin: RequestHandler,
  deleteAccount: Pick<DeleteAccountUseCase, 'closeByStaff' | 'preview'>,
) {
  const router = Router();
  /** What closing this account would strand or end, worded for staff, before the dialog opens. */
  router.get('/:id/closure', auth, admin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id);
      if (!OBJECT_ID.test(id)) throw new AppError('Account not found', 404);
      const { blockers, openCampaigns, canClose } = await deleteAccount.preview(id);
      res.set('Cache-Control', 'private, no-store');
      res.json({ data: { canClose, blockers, openCampaigns, ...(canClose ? {} : { message: describeClosureBlockersForStaff(blockers) }) } });
    } catch (error) { next(error); }
  });
  router.post('/:id/close', auth, admin, validate(closeSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id);
      if (!OBJECT_ID.test(id)) throw new AppError('Account not found', 404);
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
      // The audit row records what actually happened, so it is written only
      // once the outcome is known (a row written first claimed closures that
      // then failed).
      const audit = (action: string, details: string, statusCode: number) => AuditLogModel.create({
        actorId: req.userId, actorRole: 'admin', action, resource: `user:${id}`, details, reason: input.verificationNote,
        severity: 'warning', method: 'POST', path: '/admin/users/:id/close', statusCode,
        ip: clientIp(req), userAgent: req.get('user-agent'),
      });
      try {
        await deleteAccount.closeByStaff(id);
      } catch (error) {
        const blockers = error instanceof AppError && error.statusCode === 409 ? error.errors?.accountClosure : undefined;
        if (blockers) {
          // Staff must still see the blockers if this row cannot be written;
          // the generic auditMutation row records the 409 attempt as well.
          await audit('account.staff_closure_refused', `Staff-assisted account closure refused; outstanding: ${blockers.join(', ')}`, 409)
            .catch((auditError: unknown) => logger.error({ err: auditError, actorId: req.userId, userId: id }, 'staff closure refusal audit write failed'));
        }
        throw error;
      }
      // The account is closed now. If this row cannot be written, the generic
      // auditMutation row (actor, path, 200) still records the closure, so a
      // failure here must not turn a completed closure into an error staff retry.
      await audit('account.staff_closure', 'Staff-assisted account closure completed: erasure requested and every session revoked', 200)
        .catch((error: unknown) => logger.error({ err: error, actorId: req.userId, userId: id }, 'staff closure audit write failed'));
      res.json({ data: { closed: true } });
    } catch (error) { next(error); }
  });
  return router;
}
