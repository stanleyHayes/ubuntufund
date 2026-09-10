import { randomUUID } from 'node:crypto';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { CreateDonationIntentUseCase } from '../../../../../application/use-cases/CreateDonationIntentUseCase.js';
import type { RecordPaymentAttemptUseCase } from '../../../../../application/use-cases/RecordPaymentAttemptUseCase.js';
import type { GetDonationIntentPublicUseCase } from '../../../../../application/use-cases/GetDonationIntentPublicUseCase.js';
import type { AddDonationMessageUseCase } from '../../../../../application/use-cases/AddDonationMessageUseCase.js';
import type { VerifyDonationIntentUseCase } from '../../../../../application/use-cases/VerifyDonationIntentUseCase.js';
import { toDonationIntentPublicView } from '../../../../../application/use-cases/GetDonationIntentPublicUseCase.js';

function firstHeaderValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

export class DonationIntentController {
  constructor(
    private readonly createDonationIntentUseCase: CreateDonationIntentUseCase,
    private readonly recordPaymentAttemptUseCase: RecordPaymentAttemptUseCase,
    private readonly getDonationIntentPublicUseCase: GetDonationIntentPublicUseCase,
    private readonly addDonationMessageUseCase: AddDonationMessageUseCase,
    private readonly verifyDonationIntentUseCase: VerifyDonationIntentUseCase
  ) {}

  /** POST /donation-intents — PUBLIC (guests allowed). Optional auth. */
  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Prefer the standard Idempotency-Key header; fall back to the body, then
      // to a generated key (dedupe only works when the client supplies one).
      const idempotencyKey =
        firstHeaderValue(req.headers['idempotency-key']) ??
        (typeof req.body?.idempotencyKey === 'string'
          ? req.body.idempotencyKey
          : undefined) ??
        randomUUID();

      const result = await this.createDonationIntentUseCase.execute(req.body, {
        donorUserId: req.userId ?? null,
        idempotencyKey,
      });

      const intentView = {
        ...toDonationIntentPublicView(result.intent),
        providerRef: result.intent.providerRef,
      };

      // Paystack rail: wrap the intent with the hosted-checkout handoff the
      // donor is redirected to. The wallet rail returns the intent directly.
      if (result.hostedInit) {
        res.status(201).json({
          data: {
            intent: intentView,
            authorization_url: result.hostedInit.authorizationUrl,
            access_code: result.hostedInit.accessCode,
            reference: result.hostedInit.reference,
          },
          message: 'Donation intent created',
          status: 201,
        });
        return;
      }

      res.status(201).json({
        data: intentView,
        message: 'Donation intent created',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /donation-intents/:id/payment-attempts — PUBLIC. */
  recordAttempt = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const attempt = await this.recordPaymentAttemptUseCase.execute(
        req.params.id as string,
        req.body
      );
      res.status(201).json({
        data: attempt,
        message: 'Payment attempt recorded',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /donation-intents/:id/public — PUBLIC status polling. */
  getPublic = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const view = await this.getDonationIntentPublicUseCase.execute(
        req.params.id as string
      );
      res.json({
        data: view,
        message: 'Donation intent retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /donation-intents/:id/verify — verify a guest's hosted checkout server-side. */
  verify = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const view = await this.verifyDonationIntentUseCase.execute(String(req.params.id), req.body.reference);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ data: view, message: 'Payment status verified', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** POST /donations/:id/message — authenticated donor edits their message. */
  addMessage = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.addDonationMessageUseCase.execute(
        req.params.id as string,
        req.userId!,
        req.body.message
      );
      res.json({
        data: result,
        message: 'Donation message updated',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
