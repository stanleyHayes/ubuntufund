import { api } from './api'
import type { CouponPreview, CouponValidationInput } from '@ubuntu-fund/types'

// POST /coupons/preview — a soft endpoint that returns { valid, reason?, ... }
// rather than throwing for a bad code. Use it to quote a discount before the
// user commits; pass the same code into the checkout body to actually apply it.
export async function previewCoupon(input: CouponValidationInput): Promise<CouponPreview> {
  return api.post<CouponPreview>('/coupons/preview', input)
}
