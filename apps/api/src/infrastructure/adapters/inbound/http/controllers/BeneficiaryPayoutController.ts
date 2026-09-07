import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { BeneficiaryPayoutUseCase } from '../../../../../application/use-cases/BeneficiaryPayoutUseCase.js';

/**
 * HTTP surface for per-beneficiary payouts (spec §17). Recipient registration
 * and payout requests are owner/beneficiary; KYC verification + approval are
 * admin-only.
 */
export class BeneficiaryPayoutController {
  constructor(private readonly useCase: BeneficiaryPayoutUseCase) {}

  private requester(req: AuthenticatedRequest) {
    return { userId: req.userId!, role: req.userRole };
  }

  registerRecipient = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const recipient = await this.useCase.registerRecipient(
        req.params.id as string,
        req.params.beneficiaryId as string,
        req.body,
        this.requester(req)
      );
      res.status(201).json({ data: recipient, message: 'Recipient registered', status: 201 });
    } catch (error) {
      next(error);
    }
  };

  verifyKyc = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const recipient = await this.useCase.verifyKyc(
        req.params.id as string,
        req.params.beneficiaryId as string,
        this.requester(req)
      );
      res.json({ data: recipient, message: 'KYC verified', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  requestPayout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payout = await this.useCase.requestPayout(
        req.params.id as string,
        req.params.beneficiaryId as string,
        req.body.amount,
        this.requester(req)
      );
      res.status(201).json({ data: payout, message: 'Payout requested', status: 201 });
    } catch (error) {
      next(error);
    }
  };

  listByCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payouts = await this.useCase.listByCampaign(
        req.params.id as string,
        this.requester(req)
      );
      res.json({ data: payouts, message: 'Beneficiary payouts', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  approve = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payout = await this.useCase.approvePayout(
        req.params.payoutId as string,
        this.requester(req)
      );
      res.json({ data: payout, message: 'Payout approved', status: 200 });
    } catch (error) {
      next(error);
    }
  };
}
