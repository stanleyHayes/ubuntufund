# API: subscription plans and checkout

All paths are under `/api/v1`. Responses use the usual envelope `{ data, message?, status }`; errors are `{ message, status, errors? }`, where `errors` maps a field to its messages. Plan types live in `packages/types/src/subscription.ts`. Prices are GHS list prices.

This page records the plan and checkout behaviour changed on 2026-09-30 (pricing audit). Marked **Changed** where a status or response differs from before.

## Which plans can be bought

A plan is sold self-serve when it is active, public, and neither Free (nothing to buy) nor Enterprise (arranged with sales). Web checkout, the coupon preview and the app-store catalog all apply this one rule, so no surface quotes a plan another one refuses to sell.

## Plans

| Call | Who | Notes |
|---|---|---|
| `GET /plans/public` | anyone | Active, public plans only, `Cache-Control: no-store`. `500` when plans cannot be read (unchanged). |
| `GET /plans` | signed in | Every plan: the stored rows plus any built-in tier not stored yet. **Changed:** when plans cannot be read this is now a `500`. It used to answer `200` with the code defaults (Community, Plus at 49, …), which the admin editor could then save over the real plans. Show an error with a retry; never substitute defaults. |
| `PUT /plans/:tier` | admin | Patch any editable field. Validation below. |
| `POST /plans` | admin | Create a tier. Validation below; `409` for an existing tier id. |

Both lists are ordered by `sortOrder`, then monthly price, then tier id, so plans that tie keep a stable order.

Every plan read now carries a number in `maxCollaboratorsPerCampaign`. Rows written before that field existed (the launch Free, Starter, Pro and Enterprise rows in production) used to omit it, so clients showed `undefined` and enforcement applied no cap. They now read their tier's built-in cap: Free 0, Starter 0, Pro 3, Enterprise -1 (unlimited, as it was). A tier an admin added reads 0 if it has none.

### Validation (**Changed**)

Per field, at the route (`400`, message `Validation failed`):

- `priceMonthly` and `priceYearly`: 0 to 1,000,000, at most two decimal places (`errors.<field>`: `Use at most two decimal places` or `Must be 1,000,000 or less`). Checkout charges prices rounded to two decimals, so 9.995 would be shown as one price and charged as another. A price of 0 means that billing cycle is not offered.

On the plan as it will be saved: the stored plan with the edit applied (`PUT`), or the new plan (`POST`). Both answer `422`:

- Both prices above 0 and the yearly price above 12 × the monthly price, compared in pesewas. `errors.priceYearly` repeats the message, which names the 12 × monthly figure.
- `onBehalfCampaigns` true with `maxOnBehalfCampaigns` 0 (a new plan without a limit counts as 0): `Switched on, but 0 allowed: nobody on this plan could start one. Set a limit or -1 for unlimited.`, also in `errors.maxOnBehalfCampaigns`.

Because the whole saved plan is checked, a stored plan that already breaks a rule must be fixed in the same edit before any other change can be saved. The dialog in Admin → Plans sends every field, so this means setting the limit (or switching the feature off) while saving.

## Web checkout

`POST /subscriptions/checkout` (signed in), body `{ tier, billingCycle, couponCode?, replaceCurrentPlan? }`.

- **Changed:** `tier` is any string of 1–60 characters after trimming, so a tier an admin created can be bought. It used to accept only the built-in tier ids (`400 Validation failed` for any other).
- `400 That subscription plan is not available`: an unknown or inactive tier.
- `403`: Enterprise or a hidden (non-public) plan (`Contact sales@ujimora.com`).
- `400`: Free, or a billing cycle priced 0 on the plan.
- **Changed:** `500` when the plan cannot be read. No checkout or charge is opened. It used to charge the code default price instead (Pro 149 rather than the admin-set price).
- **Changed:** `409` with `errors.code = ['checkout_in_progress']` (and `errors.checkoutId`) now also when the member's open checkout for the same plan, cycle and code was opened at a different list price, because an admin changed the price since. The member cancels it (`POST /subscriptions/checkout/:id/abandon`) and continues at the current price. It used to resume the old payment page at the old price.

## Coupon preview

`POST /coupons/preview` (signed in), subscription surface. It still never throws; refusals come back as `{ valid: false, reason, baseAmount, finalAmount }`.

- **Changed:** `reason: 'Plan prices are unavailable right now'` with `baseAmount: 0` when the plan cannot be read. It used to quote the code default prices.
- **Changed:** `reason: 'That subscription plan is not available'` with `baseAmount: 0` for a plan checkout would not sell: Enterprise, hidden, inactive, Free, or an unknown tier. An unknown tier used to preview as the Free plan (valid, pay 0), and Enterprise as a normal priced plan that checkout then refused.
- **Changed:** `reason: 'That billing cycle is not available for this plan'` with `baseAmount: 0` for a billing cycle priced 0 on the plan, which checkout refuses with `400`. It used to preview as valid, pay 0.

## App-store billing

- **Changed:** `GET /store-billing/catalog/:store` lists only products whose plan passes the self-serve rule, so an Enterprise product in `STORE_BILLING_PRODUCTS` is never offered in the apps.
- **Changed:** `POST /store-billing/prepare` answers `422 This plan is not available for purchase.` for such a product, before the store rail is claimed.

## Not visible in responses

- Startup seeding inserts only missing built-in plans, as before, and now stamps `createdAt`/`updatedAt` on insert only: `updatedAt` changes only when a plan is really edited (it used to be re-stamped on every boot).
- After seeding, each stored built-in plan whose name, prices, platform fee or sort order differs from `SUBSCRIPTION_PLANS` is logged as one warning (`Plan "<tier>" differs from the code price book: …`). Nothing is overwritten; plan changes are made in Admin → Plans.
- Subscription activity alerts name the plan as members see it (`Your Starter subscription is active.`), falling back to the tier id when the plan has no row.
