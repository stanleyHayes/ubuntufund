/**
 * Number of minor units per major unit, by ISO-4217 exponent. Most currencies
 * are 2 (GHS/USD/GBP/EUR/CAD); a few are 0 or 3. Unknown codes default to 2.
 * Used to convert between contributor-facing major amounts and the integer
 * minor units money is stored/settled in (spec §8 — never floats for money).
 */
const CURRENCY_MINOR_EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  XOF: 0,
  XAF: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  // Crypto assets (Crypto Donations plan §6) — stablecoins 6dp, BTC 8dp — so
  // minor-unit conversions of an original crypto amount are correctly scaled
  // (e.g. the FX rate SettleDonation derives from original→settlement).
  USDT: 6,
  USDC: 6,
  BTC: 8,
};

/** ISO-4217 minor-unit exponent for a currency (default 2). */
export function minorUnitExponent(currency: string): number {
  return CURRENCY_MINOR_EXPONENT[currency.toUpperCase()] ?? 2;
}

/** Convert a major-unit amount to integer minor units for the given currency. */
export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** minorUnitExponent(currency));
}

/** Convert integer minor units back to a major-unit amount for the currency. */
export function fromMinorUnits(minor: number, currency: string): number {
  return minor / 10 ** minorUnitExponent(currency);
}

export class Money {
  readonly amount: number;
  readonly currency: string;

  constructor(amount: number, currency: string) {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    if (!currency || currency.length < 2) {
      throw new Error('Invalid currency code');
    }
    // Round to the currency's own minor-unit precision (2 for GHS/USD/…, 0 for
    // XOF/JPY, 3 for KWD/BHD) — never a hardcoded 2dp, so minor-unit round-trips
    // and fee splits stay exact for non-2-decimal currencies (spec §8).
    const factor = 10 ** minorUnitExponent(currency);
    this.amount = Math.round(amount * factor) / factor;
    this.currency = currency.toUpperCase();
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    if (other.amount > this.amount) {
      throw new Error('Insufficient funds');
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  /** Build a Money from integer minor units (e.g. pesewas/cents). */
  static fromMinor(minor: number, currency: string): Money {
    return new Money(fromMinorUnits(minor, currency), currency);
  }

  /** This amount as integer minor units for its currency. */
  toMinor(): number {
    return toMinorUnits(this.amount, this.currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: ${this.currency} vs ${other.currency}`
      );
    }
  }
}
