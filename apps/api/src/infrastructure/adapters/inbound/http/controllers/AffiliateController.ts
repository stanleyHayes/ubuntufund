import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { EnrollAffiliateUseCase } from '../../../../../application/use-cases/EnrollAffiliateUseCase.js';
import type { GetAffiliateDashboardUseCase } from '../../../../../application/use-cases/GetAffiliateDashboardUseCase.js';
import type { ListMyAffiliateReferralsUseCase } from '../../../../../application/use-cases/ListMyAffiliateReferralsUseCase.js';
import type { ListMyAffiliateCommissionsUseCase } from '../../../../../application/use-cases/ListMyAffiliateCommissionsUseCase.js';
import type { SetAffiliatePayoutRecipientUseCase } from '../../../../../application/use-cases/SetAffiliatePayoutRecipientUseCase.js';
import type { RequestAffiliatePayoutUseCase } from '../../../../../application/use-cases/RequestAffiliatePayoutUseCase.js';
import type { ListAffiliatesUseCase } from '../../../../../application/use-cases/ListAffiliatesUseCase.js';
import type { GetAffiliateDetailUseCase } from '../../../../../application/use-cases/GetAffiliateDetailUseCase.js';
import type { SetAffiliateCommissionRateUseCase } from '../../../../../application/use-cases/SetAffiliateCommissionRateUseCase.js';
import type { UpdateAffiliateStatusUseCase } from '../../../../../application/use-cases/UpdateAffiliateStatusUseCase.js';
import type { ListAffiliatePayoutsUseCase } from '../../../../../application/use-cases/ListAffiliatePayoutsUseCase.js';
import type { ApproveAffiliatePayoutUseCase } from '../../../../../application/use-cases/ApproveAffiliatePayoutUseCase.js';

export class AffiliateController {
  constructor(
    private readonly enrollAffiliateUseCase: EnrollAffiliateUseCase,
    private readonly getAffiliateDashboardUseCase: GetAffiliateDashboardUseCase,
    private readonly listMyAffiliateReferralsUseCase: ListMyAffiliateReferralsUseCase,
    private readonly listMyAffiliateCommissionsUseCase: ListMyAffiliateCommissionsUseCase,
    private readonly setAffiliatePayoutRecipientUseCase: SetAffiliatePayoutRecipientUseCase,
    private readonly requestAffiliatePayoutUseCase: RequestAffiliatePayoutUseCase,
    private readonly listAffiliatesUseCase: ListAffiliatesUseCase,
    private readonly getAffiliateDetailUseCase: GetAffiliateDetailUseCase,
    private readonly setAffiliateCommissionRateUseCase: SetAffiliateCommissionRateUseCase,
    private readonly updateAffiliateStatusUseCase: UpdateAffiliateStatusUseCase,
    private readonly listAffiliatePayoutsUseCase: ListAffiliatePayoutsUseCase,
    private readonly approveAffiliatePayoutUseCase: ApproveAffiliatePayoutUseCase
  ) {}

  // ── Owner ('me') ──────────────────────────────────────────────────────────

  /** POST /affiliate/enroll — join the affiliate program; mints a code (idempotent). */
  enroll = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const affiliate = await this.enrollAffiliateUseCase.execute(req.userId!);
      res.status(201).json({
        data: affiliate,
        message: 'Enrolled in affiliate program',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /affiliate — the current user's affiliate dashboard. */
  dashboard = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const dashboard = await this.getAffiliateDashboardUseCase.execute(
        req.userId!
      );
      res.json({ data: dashboard, message: 'Affiliate dashboard', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** GET /affiliate/referrals — the current user's referred signups. */
  referrals = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const referrals = await this.listMyAffiliateReferralsUseCase.execute(
        req.userId!
      );
      res.json({ data: referrals, message: 'Referrals retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** GET /affiliate/commissions — the current user's commission ledger. */
  commissions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const commissions = await this.listMyAffiliateCommissionsUseCase.execute(
        req.userId!
      );
      res.json({
        data: commissions,
        message: 'Commissions retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /affiliate/payout-recipient — register a payout destination (owner). */
  setRecipient = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const affiliate = await this.setAffiliatePayoutRecipientUseCase.execute(
        req.userId!,
        req.body
      );
      res.status(201).json({
        data: affiliate,
        message: 'Payout recipient saved',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /affiliate/payouts — request a payout of available commission (owner). */
  requestPayout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payout = await this.requestAffiliatePayoutUseCase.execute(
        req.userId!,
        req.body
      );
      res.status(201).json({
        data: payout,
        message: 'Payout requested',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  // ── Admin ─────────────────────────────────────────────────────────────────

  /** GET /affiliates — every affiliate across the platform (admin). */
  list = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const affiliates = await this.listAffiliatesUseCase.execute();
      res.json({
        data: affiliates,
        message: 'Affiliates retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /affiliates/:id — one affiliate's full detail view (admin). */
  detail = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const detail = await this.getAffiliateDetailUseCase.execute(
        req.params.id as string
      );
      res.json({ data: detail, message: 'Affiliate retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** PUT /affiliates/:id/commission-rate — override the commission rate (admin). */
  setRate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const affiliate = await this.setAffiliateCommissionRateUseCase.execute(
        req.params.id as string,
        req.body
      );
      res.json({
        data: affiliate,
        message: 'Commission rate updated',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** PUT /affiliates/:id/status — activate or suspend an affiliate (admin). */
  updateStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const affiliate = await this.updateAffiliateStatusUseCase.execute(
        req.params.id as string,
        req.body
      );
      res.json({
        data: affiliate,
        message: 'Affiliate status updated',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /affiliates/payouts — every affiliate payout across the platform (admin). */
  listPayouts = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payouts = await this.listAffiliatePayoutsUseCase.execute();
      res.json({
        data: payouts,
        message: 'Affiliate payouts retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /affiliates/payouts/:id/approve — approve + initiate a transfer (admin). */
  approvePayout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payout = await this.approveAffiliatePayoutUseCase.execute(
        req.params.id as string,
        { userId: req.userId!, role: req.userRole }
      );
      res.json({
        data: payout,
        message: 'Affiliate payout approved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
