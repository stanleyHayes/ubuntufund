import { Router } from 'express';
import { z } from 'zod';
import type { PlanService } from '../../../../../application/services/PlanService.js';
import type { StoreBillingRuntime } from '../../../../config/storeBilling.js';
import { MongoBillingOwnership } from '../../../outbound/persistence/MongoBillingOwnership.js';
import { MongoSubscriptionRepository } from '../../../outbound/persistence/MongoSubscriptionRepository.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { storeBillingRateLimiter as billingLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';

const storeSchema = z.enum(['apple', 'google']);
const prepareSchema = z.object({ store: storeSchema, productId: z.string().min(1).max(200), basePlanId: z.string().max(100).optional() }).strict();
const verifySchema = z.object({ store: storeSchema, reference: z.string().min(1).max(4096) }).strict();

export function createStoreBillingRoutes(runtime: StoreBillingRuntime | null, plans: PlanService, auth: ReturnType<typeof createAuthMiddleware>) {
  const router = Router();
  const ownership = new MongoBillingOwnership();
  const subscriptions = new MongoSubscriptionRepository();
  router.use(auth);
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/catalog/:store', async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = storeSchema.safeParse(req.params.store);
      if (!parsed.success) throw new AppError('Choose a supported app store.', 400);
      const store = parsed.data;
      const account = await ownership.account(req.userId!);
      const products = [];
      for (const product of runtime?.products.filter((p) => p.store === store) ?? []) {
        const plan = await plans.getPlan(product.tier, true);
        if (plan.tier === product.tier && plan.active && plan.isPublic) products.push({ ...product, plan });
      }
      res.json({ data: { available: products.length > 0, provider: account.provider ?? null, products } });
    } catch (error) { next(error); }
  });
  router.post('/prepare', billingLimiter, validate(prepareSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!runtime) throw new AppError('Store purchases are temporarily unavailable.', 503);
      const product = runtime.products.find((p) => p.store === req.body.store && p.productId === req.body.productId && p.basePlanId === req.body.basePlanId);
      if (!product) throw new AppError('This store product is not available.', 422);
      const plan = await plans.getPlan(product.tier, true);
      if (plan.tier !== product.tier || !plan.active || !plan.isPublic) throw new AppError('This plan is not available for purchase.', 422);
      await ownership.claimProvider(req.userId!, product.store);
      const account = await ownership.account(req.userId!);
      res.json({ data: { accountToken: account.accountToken } });
    } catch (error) { next(error); }
  });
  router.post('/verify', billingLimiter, validate(verifySchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!runtime || !runtime.products.some((p) => p.store === req.body.store)) throw new AppError('Store verification is temporarily unavailable.', 503);
      const result = await runtime.billing.verifyForUser(req.userId!, req.body.store, req.body.reference);
      res.json({ data: { ...result, subscription: await subscriptions.findByUserId(req.userId!) } });
    } catch (error) { next(error); }
  });
  return router;
}

/** Signature validation precedes durable enqueue; no native/user token authorizes these routes. */
export function createStoreBillingWebhookRoutes(runtime: StoreBillingRuntime | null) {
  const router = Router();
  router.post('/apple', validate(z.object({ signedPayload: z.string().min(1).max(100_000) })), async (req, res, next) => {
    try {
      if (!runtime) throw new AppError('Store notifications are not configured.', 503);
      const reference = await runtime.verifier.appleNotification(req.body.signedPayload);
      if (reference) await runtime.billing.enqueueNotification('apple', reference);
      res.sendStatus(200);
    } catch (error) { next(error); }
  });
  router.post('/google', async (req, res, next) => {
    try {
      if (!runtime) throw new AppError('Store notifications are not configured.', 503);
      const reference = await runtime.verifier.googleNotification(req.get('authorization') ?? '', req.body);
      if (reference) await runtime.billing.enqueueNotification('google', reference);
      res.sendStatus(200);
    } catch (error) { next(error); }
  });
  return router;
}
