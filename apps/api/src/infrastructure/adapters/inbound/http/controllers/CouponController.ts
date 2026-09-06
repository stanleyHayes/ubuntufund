import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { CreateCouponUseCase } from '../../../../../application/use-cases/CreateCouponUseCase.js';
import type { ListCouponsUseCase } from '../../../../../application/use-cases/ListCouponsUseCase.js';
import type { GetCouponUseCase } from '../../../../../application/use-cases/GetCouponUseCase.js';
import type { UpdateCouponUseCase } from '../../../../../application/use-cases/UpdateCouponUseCase.js';
import type { DeleteCouponUseCase } from '../../../../../application/use-cases/DeleteCouponUseCase.js';
import type { PreviewCouponUseCase } from '../../../../../application/use-cases/PreviewCouponUseCase.js';

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

/** Parse a boolean-ish query flag (?active=true / ?active=false). */
function boolQueryValue(value: unknown): boolean | undefined {
  const raw = firstQueryValue(value);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

export class CouponController {
  constructor(
    private readonly createCouponUseCase: CreateCouponUseCase,
    private readonly listCouponsUseCase: ListCouponsUseCase,
    private readonly getCouponUseCase: GetCouponUseCase,
    private readonly updateCouponUseCase: UpdateCouponUseCase,
    private readonly deleteCouponUseCase: DeleteCouponUseCase,
    private readonly previewCouponUseCase: PreviewCouponUseCase
  ) {}

  /** GET /coupons?active= — every coupon, newest first (admin). */
  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const active = boolQueryValue(req.query.active);
      const coupons = await this.listCouponsUseCase.execute(
        active === undefined ? undefined : { active }
      );
      res.json({ data: coupons, message: 'Coupons retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** GET /coupons/:id — a single coupon (admin). */
  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const coupon = await this.getCouponUseCase.execute(req.params.id as string);
      res.json({ data: coupon, message: 'Coupon retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** POST /coupons — create a coupon (admin). */
  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const coupon = await this.createCouponUseCase.execute(req.body);
      res.status(201).json({
        data: coupon,
        message: 'Coupon created',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  /** PUT /coupons/:id — edit a coupon; code is immutable (admin). */
  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const coupon = await this.updateCouponUseCase.execute(
        req.params.id as string,
        req.body
      );
      res.json({ data: coupon, message: 'Coupon updated', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /coupons/:id — remove a coupon (admin). */
  remove = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await this.deleteCouponUseCase.execute(req.params.id as string);
      res.json({ data: null, message: 'Coupon deleted', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** POST /coupons/preview — quote a coupon against a plan (auth). Never throws on an invalid coupon. */
  preview = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const preview = await this.previewCouponUseCase.execute(
        req.body,
        req.userId!
      );
      res.json({ data: preview, message: 'Coupon preview', status: 200 });
    } catch (error) {
      next(error);
    }
  };
}
