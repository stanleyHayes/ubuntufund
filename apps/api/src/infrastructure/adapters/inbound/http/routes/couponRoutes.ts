import { Router } from 'express';
import { z } from 'zod';
import {
  SubscriptionTier,
  BillingCycle,
  CouponDiscountType,
  CouponSurface,
  CouponCommissionBase,
} from '@ubuntu-fund/types';
import type { CouponController } from '../controllers/CouponController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireAdmin } from '../../middleware/requireRole.js';

const createCouponSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  discountType: z.nativeEnum(CouponDiscountType),
  amount: z.number().positive(),
  maxRedemptions: z.number().int().nonnegative().optional(),
  perUserLimit: z.number().int().nonnegative().optional(),
  minSubtotal: z.number().nonnegative().optional(),
  // Free-form tier ids, not the built-in enum: PlanService supports
  // admin-added tiers and the schema documents this field as free-form, so
  // validating against SubscriptionTier made a coupon impossible to scope to
  // any tier an admin created.
  appliesToTiers: z.array(z.string().min(1).max(60)).optional(),
  appliesToBillingCycles: z.array(z.nativeEnum(BillingCycle)).optional(),
  maxDiscountAmount: z.number().nonnegative().optional(),
  appliesToSurfaces: z.array(z.nativeEnum(CouponSurface)).optional(),
  commissionBase: z.nativeEnum(CouponCommissionBase).optional(),
  newUsersOnly: z.boolean().optional(),
  allowedEmails: z.array(z.string().email()).max(500).optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  active: z.boolean().optional(),
});

const updateCouponSchema = z.object({
  description: z.string().max(500).optional(),
  discountType: z.nativeEnum(CouponDiscountType).optional(),
  amount: z.number().positive().optional(),
  maxRedemptions: z.number().int().nonnegative().optional(),
  perUserLimit: z.number().int().nonnegative().optional(),
  minSubtotal: z.number().nonnegative().optional(),
  // Free-form tier ids, not the built-in enum: PlanService supports
  // admin-added tiers and the schema documents this field as free-form, so
  // validating against SubscriptionTier made a coupon impossible to scope to
  // any tier an admin created.
  appliesToTiers: z.array(z.string().min(1).max(60)).optional(),
  appliesToBillingCycles: z.array(z.nativeEnum(BillingCycle)).optional(),
  maxDiscountAmount: z.number().nonnegative().optional(),
  appliesToSurfaces: z.array(z.nativeEnum(CouponSurface)).optional(),
  commissionBase: z.nativeEnum(CouponCommissionBase).optional(),
  newUsersOnly: z.boolean().optional(),
  allowedEmails: z.array(z.string().email()).max(500).optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  active: z.boolean().optional(),
}); // code is immutable after creation

const previewCouponSchema = z.object({
  code: z.string().min(1).max(50),
  // Omitted means the subscription surface, so existing clients are unaffected.
  surface: z.nativeEnum(CouponSurface).optional(),
  tier: z.string().min(1).max(60).optional(),
  billingCycle: z.nativeEnum(BillingCycle).optional(),
  // Donation surface: the campaign whose fee would be waived, and the gift.
  campaignId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
});

/**
 * The coupon resource:
 *   POST /coupons/preview → quote a coupon against a plan (any signed-in user)
 *
 *   Admin console CRUD (Resource.COUPONS), guarded by requireAdmin:
 *   GET    /coupons        → list every coupon (newest first; ?active= filter)
 *   POST   /coupons        → create a coupon
 *   GET    /coupons/:id    → fetch one coupon
 *   PUT    /coupons/:id    → edit a coupon (code immutable)
 *   DELETE /coupons/:id    → delete a coupon
 */
export function createCouponRoutes(
  couponController: CouponController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  adminGuard: typeof requireAdmin
): Router {
  const router = Router();

  // Auth-only: a signed-in user previews a coupon before checkout.
  router.post(
    '/preview',
    authMiddleware,
    validate(previewCouponSchema),
    couponController.preview
  );

  // Admin CRUD.
  router.get('/', authMiddleware, adminGuard, couponController.list);
  router.post(
    '/',
    authMiddleware,
    adminGuard,
    validate(createCouponSchema),
    couponController.create
  );
  router.get('/:id', authMiddleware, adminGuard, couponController.getById);
  router.put(
    '/:id',
    authMiddleware,
    adminGuard,
    validate(updateCouponSchema),
    couponController.update
  );
  router.delete('/:id', authMiddleware, adminGuard, couponController.remove);

  return router;
}
