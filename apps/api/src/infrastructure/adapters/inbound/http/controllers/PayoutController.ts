import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { ListBanksUseCase } from '../../../../../application/use-cases/ListBanksUseCase.js';
import type { CreatePayoutRecipientUseCase } from '../../../../../application/use-cases/CreatePayoutRecipientUseCase.js';
import type { RequestPayoutUseCase } from '../../../../../application/use-cases/RequestPayoutUseCase.js';
import type { ApprovePayoutUseCase } from '../../../../../application/use-cases/ApprovePayoutUseCase.js';
import type { ListCampaignPayoutsUseCase } from '../../../../../application/use-cases/ListCampaignPayoutsUseCase.js';
import type { ListPayoutsUseCase } from '../../../../../application/use-cases/ListPayoutsUseCase.js';

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

export class PayoutController {
  constructor(
    private readonly listBanksUseCase: ListBanksUseCase,
    private readonly createPayoutRecipientUseCase: CreatePayoutRecipientUseCase,
    private readonly requestPayoutUseCase: RequestPayoutUseCase,
    private readonly approvePayoutUseCase: ApprovePayoutUseCase,
    private readonly listCampaignPayoutsUseCase: ListCampaignPayoutsUseCase,
    private readonly listPayoutsUseCase: ListPayoutsUseCase
  ) {}

  /** GET /banks?currency=GHS&type=mobile_money — bank / telco directory. */
  listBanks = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const banks = await this.listBanksUseCase.execute(
        firstQueryValue(req.query.currency),
        firstQueryValue(req.query.type)
      );
      res.json({ data: banks, message: 'Banks retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** POST /campaigns/:id/payout-recipient — register a recipient (owner). */
  createRecipient = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const recipient = await this.createPayoutRecipientUseCase.execute(
        req.params.id as string,
        req.body,
        { userId: req.userId!, role: req.userRole }
      );
      res.status(201).json({
        data: recipient,
        message: 'Payout recipient added',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /campaigns/:id/payouts — request a payout (owner). */
  requestPayout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payout = await this.requestPayoutUseCase.execute(
        req.params.id as string,
        req.body,
        { userId: req.userId!, role: req.userRole }
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

  /** GET /campaigns/:id/payouts — a campaign's payouts (owner/admin). */
  listCampaignPayouts = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payouts = await this.listCampaignPayoutsUseCase.execute(
        req.params.id as string,
        { userId: req.userId!, role: req.userRole }
      );
      res.json({ data: payouts, message: 'Payouts retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** POST /payouts/:id/approve — approve + initiate a transfer (admin). */
  approvePayout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payout = await this.approvePayoutUseCase.execute(
        req.params.id as string,
        { userId: req.userId!, role: req.userRole }
      );
      res.json({ data: payout, message: 'Payout approved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** GET /payouts — every payout across the platform (admin). */
  listAll = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payouts = await this.listPayoutsUseCase.execute();
      res.json({ data: payouts, message: 'Payouts retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };
}
