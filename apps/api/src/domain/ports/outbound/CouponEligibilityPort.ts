/**
 * The facts about a user that a coupon's targeting rules need.
 *
 * These live behind a port rather than being passed in by callers because
 * `validateAndPrice` has two of them — the checkout that takes the money and
 * the preview that quotes it. If each computed eligibility itself they would
 * drift, and the failure mode is the worst kind: a preview that says the
 * coupon applies, followed by a checkout that refuses it at the moment the
 * customer expects to pay.
 *
 * Both methods are only ever called when a coupon actually carries the
 * corresponding restriction, so an ordinary coupon costs no extra queries.
 */
export interface CouponEligibilityPort {
  /**
   * The user's account email, lowercased, for an allowlist check.
   *
   * Null when the user cannot be resolved — treated as "not on the list"
   * rather than "unrestricted", because a coupon limited to named recipients
   * must fail closed.
   */
  emailFor(userId: string): Promise<string | null>;

  /**
   * Whether this user has ever completed a paid subscription checkout.
   *
   * This is what "new customers only" means here: not account age, which would
   * exclude someone who signed up months ago and is finally upgrading, but
   * whether they have paid before. It is also the version that cannot be
   * farmed — cancelling and re-subscribing does not make you new again.
   */
  hasPaidBefore(userId: string): Promise<boolean>;
}
