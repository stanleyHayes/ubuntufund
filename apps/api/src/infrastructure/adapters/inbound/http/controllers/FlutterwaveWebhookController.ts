import type { Request, Response, NextFunction } from 'express';
import type { HandleFlutterwaveWebhookUseCase } from '../../../../../application/use-cases/HandleFlutterwaveWebhookUseCase.js';

export class FlutterwaveWebhookController {
  constructor(
    private readonly handleFlutterwaveWebhookUseCase: HandleFlutterwaveWebhookUseCase
  ) {}

  /**
   * POST /webhooks/flutterwave — authoritative settlement callback (PUBLIC, no
   * auth; trust comes from the `verif-hash` header). Mounted with `express.raw`,
   * so `req.body` is the raw Buffer. Acknowledges 200 quickly after durable
   * receipt; signature/verification failures surface as 401/501.
   */
  handle = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const signature = req.header('verif-hash');
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(
            typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
          );

      await this.handleFlutterwaveWebhookUseCase.execute({ rawBody, signature });

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  };
}
