import type { WalletTopUpService } from '../../../outbound/payments/WalletTopUpService.js';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { WalletRepositoryPort } from '../../../../../domain/ports/outbound/WalletRepositoryPort.js';
import type { WalletTransactionRepositoryPort } from '../../../../../domain/ports/outbound/WalletTransactionRepositoryPort.js';
import { AppError } from '../../middleware/errorHandler.js';

export class WalletController {
  constructor(
    private readonly walletRepo: WalletRepositoryPort,
    private readonly walletTxRepo?: WalletTransactionRepositoryPort,
    private readonly topups?: WalletTopUpService
  ) {}

  topUpConfiguration = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: this.topups?.configuration() ?? { enabled: false, mode: 'test' } });
  };

  initializeTopUp = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.topups) throw new AppError('Top-ups unavailable', 503);
      const key = req.header('Idempotency-Key');
      if (!key || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new AppError('A valid Idempotency-Key is required', 400);
      res.status(201).json({ data: await this.topups.initialize(req.userId!, req.body.walletId, req.body.amount, key) });
    } catch (error) { next(error); }
  };

  topUpStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.topups) throw new AppError('Top-ups unavailable', 503);
      res.json({ data: await this.topups.status(req.userId!, req.params.reference as string) });
    } catch (error) { next(error); }
  };

  listTransactions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const transactions = this.walletTxRepo
        ? await this.walletTxRepo.findByUserId(req.userId!, limit)
        : [];
      res.json({ data: transactions, message: 'Transactions retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  getMyWallets = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const wallets = await this.walletRepo.findByUserId(req.userId!);
      res.json({
        data: wallets.map((w) => {
          const plain = w.toPlain();
          return {
            id: plain.id,
            userId: plain.userId,
            type: plain.type,
            currency: plain.balance.currency,
            balance: plain.balance.amount,
            createdAt: plain.createdAt,
            updatedAt: plain.updatedAt,
          };
        }),
        message: 'Wallets retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const wallet = await this.walletRepo.findById(req.params.id as string);
      if (!wallet || wallet.userId !== req.userId) {
        throw new AppError('Wallet not found', 404);
      }
      const plain = wallet.toPlain();
      res.json({
        data: {
          id: plain.id,
          userId: plain.userId,
          type: plain.type,
          currency: plain.balance.currency,
          balance: plain.balance.amount,
          createdAt: plain.createdAt,
          updatedAt: plain.updatedAt,
        },
        message: 'Wallet retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

}
