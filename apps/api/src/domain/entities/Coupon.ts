import { CouponDiscountType } from '@ubuntu-fund/types';
import type { BillingCycle } from '@ubuntu-fund/types';
import { roundToCurrency } from '../value-objects/Money.js';

export interface CouponProps {
  id: string;
  code: string; // stored UPPERCASE, unique
  description?: string;
  discountType: CouponDiscountType;
  amount: number; // percent (0-100) when PERCENT; GHS off when FIXED
  /** Ceiling on a PERCENT discount, in the coupon currency. Falsy = none. */
  maxDiscountAmount?: number;
  currency: string; // 'GHS' (only meaningful for FIXED)
  maxRedemptions?: number; // undefined/0 = unlimited (global)
  redemptions: number; // running count of CONSUMED redemptions
  perUserLimit?: number; // undefined/0 = unlimited per user
  minSubtotal?: number; // optional GHS floor the base price must meet
  appliesToTiers: string[]; // empty = all paid tiers
  appliesToBillingCycles: BillingCycle[]; // empty = all cycles
  /** Restrict to customers who have never completed a paid checkout. */
  newUsersOnly: boolean;
  /** Named recipients, lowercased. Empty = open to anyone. */
  allowedEmails: string[];
  validFrom?: Date;
  validUntil?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A discount applied to a paid-subscription checkout. Guards its own invariants
 * on construction (a positive amount; a PERCENT coupon that never exceeds 100%)
 * and answers the eligibility questions the checkout use-case asks before it
 * quotes a price: is the coupon live right now, does it apply to the chosen
 * tier/cycle, is it still under its global redemption cap, and what discount
 * does it yield against a given base amount. The per-user cap and the atomic
 * redemption increment live at the repository — this entity is pure and stateless
 * about counters beyond the running `redemptions` snapshot it was built with.
 */
export class CouponEntity {
  private props: CouponProps;

  constructor(props: CouponProps) {
    if (props.amount <= 0) {
      throw new Error('Coupon amount must be greater than zero');
    }
    if (props.discountType === CouponDiscountType.PERCENT && props.amount > 100) {
      throw new Error('Percent coupon amount cannot exceed 100');
    }
    if (props.maxDiscountAmount !== undefined && props.maxDiscountAmount < 0) {
      throw new Error('Coupon maximum discount cannot be negative');
    }
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get code(): string {
    return this.props.code;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get discountType(): CouponDiscountType {
    return this.props.discountType;
  }
  get amount(): number {
    return this.props.amount;
  }
  get currency(): string {
    return this.props.currency;
  }
  get maxRedemptions(): number | undefined {
    return this.props.maxRedemptions;
  }
  get redemptions(): number {
    return this.props.redemptions;
  }
  get perUserLimit(): number | undefined {
    return this.props.perUserLimit;
  }
  get minSubtotal(): number | undefined {
    return this.props.minSubtotal;
  }
  get appliesToTiers(): string[] {
    return this.props.appliesToTiers;
  }
  get appliesToBillingCycles(): BillingCycle[] {
    return this.props.appliesToBillingCycles;
  }
  get maxDiscountAmount(): number | undefined {
    return this.props.maxDiscountAmount;
  }
  get newUsersOnly(): boolean {
    return this.props.newUsersOnly;
  }
  get allowedEmails(): string[] {
    return this.props.allowedEmails;
  }
  get validFrom(): Date | undefined {
    return this.props.validFrom;
  }
  get validUntil(): Date | undefined {
    return this.props.validUntil;
  }
  get active(): boolean {
    return this.props.active;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Live right now: flagged active and inside the validFrom/validUntil window. */
  isActiveNow(now: Date = new Date()): boolean {
    if (!this.props.active) return false;
    if (this.props.validFrom && now < this.props.validFrom) return false;
    if (this.props.validUntil && now > this.props.validUntil) return false;
    return true;
  }

  /** Whether the coupon covers the chosen tier + billing cycle (empty list = all). */
  appliesTo(tier: string, billingCycle: BillingCycle): boolean {
    const tierOk =
      this.props.appliesToTiers.length === 0 ||
      this.props.appliesToTiers.includes(tier);
    const cycleOk =
      this.props.appliesToBillingCycles.length === 0 ||
      this.props.appliesToBillingCycles.includes(billingCycle);
    return tierOk && cycleOk;
  }

  /** Whether the base price clears the optional GHS floor (no floor = always ok). */
  meetsMinSubtotal(baseAmount: number): boolean {
    if (!this.props.minSubtotal) return true;
    return baseAmount >= this.props.minSubtotal;
  }

  /** Under the global redemption cap (a falsy cap means unlimited). */
  isUnderGlobalLimit(): boolean {
    if (!this.props.maxRedemptions) return true;
    return this.props.redemptions < this.props.maxRedemptions;
  }

  /**
   * Discount yielded against `baseAmount`, rounded to the coupon currency's own
   * minor-unit precision (2dp for GHS) and clamped so the resulting finalAmount
   * can never drop below zero (a FIXED coupon larger than the base collapses to
   * the base itself, zeroing the charge).
   */
  computeDiscount(baseAmount: number): number {
    const currency = this.props.currency;
    const isPercent = this.props.discountType === CouponDiscountType.PERCENT;
    const raw = isPercent
      ? (baseAmount * this.props.amount) / 100
      : this.props.amount;

    // The ceiling applies to percentages only: a FIXED coupon's amount already
    // is its own cap, and honouring maxDiscountAmount there would just be a
    // second, confusable way to write the same number.
    const capped =
      isPercent && this.props.maxDiscountAmount
        ? Math.min(raw, this.props.maxDiscountAmount)
        : raw;

    const clamped = Math.min(
      roundToCurrency(capped, currency),
      roundToCurrency(baseAmount, currency)
    );
    return roundToCurrency(Math.max(0, clamped), currency);
  }

  /**
   * Whether this user's email is among the named recipients.
   *
   * Fails closed: a coupon with a list and no resolvable email is not
   * redeemable. The alternative — treating an unknown email as allowed —
   * turns a targeted coupon into a public one the moment a lookup hiccups.
   */
  allowsEmail(email: string | null): boolean {
    if (this.props.allowedEmails.length === 0) return true;
    if (!email) return false;
    return this.props.allowedEmails.includes(email.toLowerCase().trim());
  }

  toPlain(): CouponProps {
    return { ...this.props };
  }
}
