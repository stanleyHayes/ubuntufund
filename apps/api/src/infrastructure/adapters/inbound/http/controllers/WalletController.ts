import type { Response, NextFunction } from 'express';
import { TransactionType } from '@ubuntu-fund/types';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { WalletRepositoryPort } from '../../../../../domain/ports/outbound/WalletRepositoryPort.js';
import type { WalletTransactionRepositoryPort } from '../../../../../domain/ports/outbound/WalletTransactionRepositoryPort.js';
import { Money } from '../../../../../domain/value-objects/Money.js';
import { AppError } from '../../middleware/errorHandler.js';

export class WalletController {
  constructor(
    private readonly walletRepo: WalletRepositoryPort,
    private readonly walletTxRepo?: WalletTransactionRepositoryPort
  ) {}

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

  private async recordTransaction(
    walletId: string,
    userId: string,
    type: TransactionType,
    money: Money
  ): Promise<void> {
    if (!this.walletTxRepo) return;
    await this.walletTxRepo.record({
      walletId,
      userId,
      type,
      amount: money.amount,
      currency: money.currency,
      reference: `${type}:${walletId}:${Date.now()}`,
    });
  }

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
      const { amount, currency } = req.body;
      const money = new Money(amount, currency);
      const updated = await this.walletRepo.depositAtomic(
        req.params.id as string,
        req.userId!,
        money
      );
      if (!updated) {
        throw new AppError('Wallet not found', 404);
      }
      await this.recordTransaction(updated.id, req.userId!, TransactionType.DEPOSIT, money);
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
      const { amount, currency } = req.body;
      const money = new Money(amount, currency);
      const existing = await this.walletRepo.findById(req.params.id as string);
      if (!existing || existing.userId !== req.userId) {
        throw new AppError('Wallet not found', 404);
      }
      const updated = await this.walletRepo.withdrawIfSufficient(
        existing.id,
        req.userId!,
        money
      );
      if (!updated) {
        throw new AppError('Insufficient wallet balance', 400);
      }
      await this.recordTransaction(updated.id, req.userId!, TransactionType.WITHDRAWAL, money);
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
