import type { Request, Response, NextFunction } from 'express';
import type { HandleCryptoWebhookUseCase } from '../../../../../application/use-cases/HandleCryptoWebhookUseCase.js';

/**
 * Receives crypto provider webhooks (Crypto Donations plan §8). Mounted with a
 * raw-body parser BEFORE the JSON parser so the adapter can verify the
 * provider's signature over the exact bytes. Always returns 200 quickly for a
 * processed/duplicate/ignored event; only a bad signature / unknown provider
 * surfaces as an error status.
 */
export class CryptoWebhookController {
  constructor(private readonly handleCryptoWebhookUseCase: HandleCryptoWebhookUseCase) {}

  handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provider = String(req.params.provider ?? '').toLowerCase();
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body ?? {});
      const outcome = await this.handleCryptoWebhookUseCase.handle(
        provider,
        req.headers,
        rawBody
      );
      res.status(200).json({ status: outcome });
    } catch (error) {
      next(error);
    }
  };
}
