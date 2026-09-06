import type { Request, Response, NextFunction } from 'express';
import type { DonationIntentStatus } from '@ubuntu-fund/types';
import type { DonationIntentEntity } from '../../../../../domain/entities/DonationIntent.js';
import type { DonationIntentRepositoryPort } from '../../../../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { PaymentAttemptRepositoryPort } from '../../../../../domain/ports/outbound/PaymentAttemptRepositoryPort.js';
import type { ReconcilePaymentsUseCase } from '../../../../../application/use-cases/ReconcilePaymentsUseCase.js';
import { AppError } from '../../middleware/errorHandler.js';

/** A contribution as the admin console sees it — normalized, no provider secrets. */
function toAdminView(i: DonationIntentEntity) {
  const p = i.toPlain();
  return {
    id: p.id,
    campaignId: p.campaignId,
    donorEmail: p.donorEmail,
    donorName: p.isAnonymous ? undefined : p.donorName,
    amount: p.amount,
    currency: p.currency,
    tip: p.tip,
    status: p.status,
    provider: p.provider,
    paymentMethod: p.paymentMethod,
    providerRef: p.providerRef,
    country: p.country,
    originalAmountMinor: p.originalAmountMinor,
    originalCurrency: p.originalCurrency,
    settlementAmountMinor: p.settlementAmountMinor,
    settlementCurrency: p.settlementCurrency,
    fxRate: p.fxRate,
    providerFeeMinor: p.providerFeeMinor,
    platformFeeMinor: p.platformFeeMinor,
    netCampaignAmountMinor: p.netCampaignAmountMinor,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export class AdminPaymentsController {
  constructor(
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly paymentAttemptRepo: PaymentAttemptRepositoryPort,
    private readonly reconcilePaymentsUseCase: ReconcilePaymentsUseCase
  ) {}

  /** GET /admin/payments — search contributions (spec §15). */
  search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const q = req.query;
      const parseDate = (v: unknown): Date | undefined => {
        if (typeof v !== 'string') return undefined;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? undefined : d;
      };
      const results = await this.donationIntentRepo.searchForAdmin({
        providerRef: typeof q.providerRef === 'string' ? q.providerRef : undefined,
        campaignId: typeof q.campaignId === 'string' ? q.campaignId : undefined,
        donorEmail: typeof q.donorEmail === 'string' ? q.donorEmail : undefined,
        status: typeof q.status === 'string' ? (q.status as DonationIntentStatus) : undefined,
        provider: typeof q.provider === 'string' ? q.provider : undefined,
        from: parseDate(q.from),
        to: parseDate(q.to),
        limit: typeof q.limit === 'string' ? Number.parseInt(q.limit, 10) || undefined : undefined,
      });
      res.json({ data: results.map(toAdminView), status: 'success' });
    } catch (error) {
      next(error);
    }
  };

  /** GET /admin/payments/:id — full end-to-end trace of a contribution (spec §23). */
  timeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const intent = await this.donationIntentRepo.findById(String(req.params.id));
      if (!intent) throw new AppError('Contribution not found', 404);
      const attempts = await this.paymentAttemptRepo.findByIntentId(intent.id);
      res.json({
        data: {
          contribution: toAdminView(intent),
          // Attempts without raw provider payloads (no secrets leaked).
          attempts: attempts.map((a) => ({
            id: a.id,
            provider: a.provider,
            providerRef: a.providerRef,
            status: a.status,
            createdAt: a.createdAt,
          })),
        },
        status: 'success',
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /admin/payments/:id/reconcile — re-verify + safely repair one (spec §15). */
  reconcileOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.reconcilePaymentsUseCase.reconcileById(String(req.params.id));
      res.json({ data: result, status: 'success' });
    } catch (error) {
      next(error);
    }
  };

  /** POST /admin/reconciliation — run the reconciliation sweep (spec §13). */
  runReconciliation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const body = (req.body ?? {}) as { olderThanMinutes?: number; limit?: number };
      const summary = await this.reconcilePaymentsUseCase.reconcileStale({
        olderThanMinutes: body.olderThanMinutes,
        limit: body.limit,
      });
      res.json({ data: summary, status: 'success' });
    } catch (error) {
      next(error);
    }
  };
}
