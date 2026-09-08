import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { CryptoAsset } from '@ubuntu-fund/types';
import type { GetCryptoAssetsUseCase } from '../../../../../application/use-cases/GetCryptoAssetsUseCase.js';
import type { CreateCryptoQuoteUseCase } from '../../../../../application/use-cases/CreateCryptoQuoteUseCase.js';
import type { CreateCryptoDepositUseCase } from '../../../../../application/use-cases/CreateCryptoDepositUseCase.js';
import { AppError } from '../../middleware/errorHandler.js';

/** Resolve the idempotency key from the header, body, or generate one. */
function resolveIdempotencyKey(req: Request): string {
  const header = req.header('Idempotency-Key');
  const body = (req.body ?? {}) as { idempotencyKey?: string };
  return header ?? body.idempotencyKey ?? randomUUID();
}

/**
 * Public crypto donation endpoints (Crypto Donations plan §17): supported
 * assets/networks (server-driven), an expiring quote, and opening a deposit.
 */
export class CryptoController {
  constructor(
    private readonly getCryptoAssetsUseCase: GetCryptoAssetsUseCase,
    private readonly createCryptoQuoteUseCase: CreateCryptoQuoteUseCase,
    private readonly createCryptoDepositUseCase: CreateCryptoDepositUseCase
  ) {}

  getAssets = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getCryptoAssetsUseCase.execute();
      res.json({ data: result, message: 'Crypto assets', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  getNetworks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const asset = String(req.params.asset ?? '').toUpperCase() as CryptoAsset;
      const { enabled, assets } = await this.getCryptoAssetsUseCase.execute();
      const match = assets.find((a) => a.asset === asset);
      if (!enabled || !match) throw new AppError('Asset not supported', 404);
      res.json({ data: match.networks, message: 'Networks', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  createQuote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const quote = await this.createCryptoQuoteUseCase.execute(
        String(req.params.id),
        req.body
      );
      res.json({ data: quote, message: 'Quote', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  createDeposit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const view = await this.createCryptoDepositUseCase.execute(
        String(req.params.id),
        req.body,
        { idempotencyKey: resolveIdempotencyKey(req) }
      );
      res.status(201).json({ data: view, message: 'Deposit created', status: 201 });
    } catch (error) {
      next(error);
    }
  };
}
