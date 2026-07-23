import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { WalletRepositoryPort } from '../../../../../domain/ports/outbound/WalletRepositoryPort.js';
import { Money } from '../../../../../domain/value-objects/Money.js';
import { AppError } from '../../middleware/errorHandler.js';

export class WalletController {
  constructor(private readonly walletRepo: WalletRepositoryPort) {}

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

  deposit = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const wallet = await this.walletRepo.findById(req.params.id as string);
      if (!wallet || wallet.userId !== req.userId) {
        throw new AppError('Wallet not found', 404);
      }

      const { amount, currency } = req.body;
      wallet.deposit(new Money(amount, currency));
      const updated = await this.walletRepo.update(wallet);
      const plain = updated.toPlain();

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
        message: 'Deposit successful',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  withdraw = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const wallet = await this.walletRepo.findById(req.params.id as string);
      if (!wallet || wallet.userId !== req.userId) {
        throw new AppError('Wallet not found', 404);
      }

      const { amount, currency } = req.body;
      wallet.withdraw(new Money(amount, currency));
      const updated = await this.walletRepo.update(wallet);
      const plain = updated.toPlain();

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
        message: 'Withdrawal successful',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
