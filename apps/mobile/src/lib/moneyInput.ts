/**
 * Parse a money amount typed by a person, in major units with at most two
 * decimal places. Returns NaN for anything else, so callers keep the submit
 * button disabled instead of sending a wrong amount.
 *
 * A single comma with no dot is read as a decimal comma ("100,50" → 100.5):
 * many phones show a comma decimal keypad. Anything ambiguous or grouped
 * ("1,000.50", "1,000") is rejected rather than guessed — "1,000" could be one
 * thousand or one cedi.
 */
export function parseMoneyInput(raw: string): number {
  const text = raw.trim()
  if (!text) return NaN
  const commas = text.split(',').length - 1
  const normalized = commas === 1 && !text.includes('.') ? text.replace(',', '.') : text
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN
  return Number(normalized)
}

/** Keep only characters a money amount can contain (digits, dot, comma). */
export function sanitizeMoneyInput(raw: string): string {
  return raw.replace(/[^\d.,]/g, '')
}

/** Wallet top-ups: GHS 1 to 10,000 with at most two decimals (the API's limits). */
export function validTopUpAmount(raw: string): boolean {
  const value = parseMoneyInput(raw)
  return Number.isFinite(value) && value >= 1 && value <= 10000
}
