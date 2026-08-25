import type { Request, Response, NextFunction } from 'express';
import type { HandlePaystackWebhookUseCase } from '../../../../../application/use-cases/HandlePaystackWebhookUseCase.js';

export class PaystackWebhookController {
  constructor(
    private readonly handlePaystackWebhookUseCase: HandlePaystackWebhookUseCase
  ) {}

  /**
   * POST /webhooks/paystack — authoritative settlement callback (PUBLIC, no
   * auth; trust comes from the HMAC signature). Mounted with `express.raw`, so
   * `req.body` is the raw Buffer the signature is verified against. Persists
   * synchronously, then acknowledges 200 quickly. Signature/verification
   * failures surface through the error handler (401/501).
   */
  handle = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const signature = req.header('x-paystack-signature');
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(
            typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
          );

      await this.handlePaystackWebhookUseCase.execute({ rawBody, signature });

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  };
}
