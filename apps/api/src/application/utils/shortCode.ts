import { randomBytes } from 'node:crypto';

// Unambiguous base32-ish alphabet: no 0/O/1/l/i to keep codes readable when
// typed off a printed QR. All lowercase so codes are case-stable in URLs.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const DEFAULT_LENGTH = 7;

/** Generate a random short code (default 7 chars) from the readable alphabet. */
export function generateShortCode(length: number = DEFAULT_LENGTH): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/**
 * Generate a short code guaranteed unique against `exists`, retrying on the
 * (astronomically rare) collision and lengthening the code as a last resort.
 */
export async function generateUniqueShortCode(
  exists: (code: string) => Promise<boolean>
): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateShortCode(DEFAULT_LENGTH + Math.floor(attempt / 3));
    if (!(await exists(code))) {
      return code;
    }
  }
  return generateShortCode(DEFAULT_LENGTH + 4);
}
