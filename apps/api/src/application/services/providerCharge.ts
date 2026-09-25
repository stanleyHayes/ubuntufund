import { fromMinorUnits, minorUnitExponent } from '../../domain/value-objects/Money.js';

/** What a provider reports it charged, in MAJOR units of `currency`. */
export interface ProviderCharge {
  amount: number;
  currency: string;
}

/**
 * Read the charged amount + currency from a Paystack event's `data`. Paystack
 * reports integer minor units of the charged currency. A missing or malformed
 * field yields a value that can never match an expected charge (NaN amount or
 * empty currency), so callers fail closed.
 */
export function parsePaystackCharge(data: { amount?: unknown; currency?: unknown }): ProviderCharge {
  const currency = typeof data.currency === 'string' ? data.currency : '';
  const minor =
    typeof data.amount === 'number' || typeof data.amount === 'string'
      ? Number(data.amount)
      : Number.NaN;
  return {
    amount: currency && Number.isFinite(minor) ? fromMinorUnits(minor, currency) : Number.NaN,
    currency,
  };
}

/**
 * True when the provider charged exactly what we expected: same currency, and
 * an amount within half a minor unit of that currency (so 0- and 3-decimal
 * currencies are not compared with a 2-decimal slop).
 */
export function chargeMatches(
  expected: { amount: number; currency: string },
  charge: ProviderCharge
): boolean {
  if (typeof charge.currency !== 'string' || !charge.currency) return false;
  if (charge.currency.toUpperCase() !== expected.currency.toUpperCase()) return false;
  if (!Number.isFinite(charge.amount)) return false;
  const tolerance = 0.5 / 10 ** minorUnitExponent(expected.currency);
  return Math.abs(charge.amount - expected.amount) <= tolerance;
}
