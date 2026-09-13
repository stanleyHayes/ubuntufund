import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { BillingStore } from '../../../../domain/ports/outbound/StorePurchaseVerifierPort.js';

export function storePurchaseKey(store: BillingStore, reference: string): string {
  return createHash('sha256').update(`${store}:${reference}`).digest('hex');
}

/** A dedicated, stable 32-byte deployment key; never reuse a JWT signing key. */
export class StoreReceiptCipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error('Store receipt encryption requires a 32-byte key.');
  }
  encrypt(store: BillingStore, reference: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(store));
    const encrypted = Buffer.concat([cipher.update(reference, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
  }
  decrypt(store: BillingStore, value: string): string {
    const [version, iv, tag, ciphertext, extra] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !ciphertext || extra !== undefined) throw new Error('Invalid encrypted store receipt.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(store));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  }
}
