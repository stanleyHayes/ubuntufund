// ---------------------------------------------------------------------------
// Coupons client — typed wrapper over the coupon preview endpoint used at
// subscription checkout (POST /coupons/preview).
//
// Built on the existing `api` client (auth-aware, unwraps the `{ data }`
// envelope). The preview endpoint is *soft*: an invalid / expired / exhausted /
// inapplicable coupon resolves to `{ valid: false, reason }` rather than
// throwing — only transport / auth failures reject.
// ---------------------------------------------------------------------------

import { api } from './api'
import type { CouponPreview, CouponValidationInput } from '@ubuntu-fund/types'

// --- Re-exported contract types (import from this module in the UI) ---------
export type { CouponPreview, CouponValidationInput } from '@ubuntu-fund/types'

/**
 * Quote a coupon against a paid plan (`POST /coupons/preview`, auth). Returns
 * the priced result including `baseAmount`, `discountAmount`, `finalAmount` and
 * `currency`; `valid: false` with a `reason` when the coupon can't be applied.
 */
export function previewCoupon(input: CouponValidationInput): Promise<CouponPreview> {
  return api.post<CouponPreview>('/coupons/preview', input)
}
