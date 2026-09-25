import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { result += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return result;
}
function decode(secret: string): Buffer {
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const letter of secret) {
    const digit = ALPHABET.indexOf(letter);
    if (digit < 0) throw new Error('Invalid authenticator secret');
    value = (value << 5) | digit; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}
export function totpAtCounter(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
export function matchTotp(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30_000);
  for (const counter of [current, current - 1, current + 1]) {
    if (counter >= 0 && timingSafeEqual(Buffer.from(totpAtCounter(secret, counter)), Buffer.from(code))) return counter;
  }
  return null;
}
export function recoveryDigest(code: string): string {
  return createHash('sha256').update(code.replace(/[\s-]/g, '').toLowerCase()).digest('hex');
}
export function newRecoveryCodes(): string[] {
  return Array.from({ length: 10 }, () => randomBytes(16).toString('hex').match(/.{4}/g)!.join('-'));
}
/** AES-GCM binds each encrypted secret to its account. Keys are separate from JWT signing. */
export class TotpCipher {
  private readonly key: Buffer | null;
  constructor(value: string) {
    this.key = /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, 'base64').length === 32 ? Buffer.from(value, 'base64') : null;
  }
  get configured() { return !!this.key; }
  encrypt(secret: string, userId: string): string {
    if (!this.key) throw new Error('Authenticator encryption is not configured');
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(`ujimora:mfa:${userId}`));
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64')).join('.');
  }
  decrypt(value: string, userId: string): string {
    if (!this.key) throw new Error('Authenticator encryption is not configured');
    const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64'));
    // Pin the full 16-byte tag: GCM otherwise accepts truncated tags, which makes forgery far easier.
    if (!iv || !tag || !encrypted || tag.length !== 16) throw new Error('Invalid authenticator secret payload');
    const cipher = createDecipheriv('aes-256-gcm', this.key, iv, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(`ujimora:mfa:${userId}`)); cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8');
  }
}
