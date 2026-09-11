import { SubscriptionCheckoutStatus } from '@ubuntu-fund/types';
import type { CouponEligibilityPort } from '../../../../domain/ports/outbound/CouponEligibilityPort.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { SubscriptionCheckoutModel } from '../../../database/models/SubscriptionCheckoutModel.js';

export class MongoCouponEligibility implements CouponEligibilityPort {
  async emailFor(userId: string): Promise<string | null> {
    // The schema lowercases on write, but normalise again: an allowlist is
    // compared by string equality and a stored mixed-case row from before that
    // rule would silently never match.
    const doc = await UserModel.findById(userId).select('email').lean();
    return doc?.email ? doc.email.toLowerCase().trim() : null;
  }

  async hasPaidBefore(userId: string): Promise<boolean> {
    // A settled checkout, not the current subscription: someone who paid and
    // later cancelled is still a returning customer, and reading the live
    // subscription would let them cancel to become "new" again.
    const prior = await SubscriptionCheckoutModel.exists({
      userId,
      status: SubscriptionCheckoutStatus.SUCCEEDED,
    });
    return prior !== null;
  }
}
