import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TotpCipher } from '../../src/application/services/Totp.js'
import { StoreReceiptCipher } from '../../src/infrastructure/adapters/outbound/payments/StoreReceiptCipher.js'

// AES-GCM decryption must insist on the full 16-byte tag; a truncated tag
// (Node accepts 4 bytes by default) makes forging a ciphertext far easier.
function truncateTag(value: string, tagIndex: number): string {
  const parts = value.split('.')
  parts[tagIndex] = Buffer.from(parts[tagIndex], 'base64').subarray(0, 4).toString('base64')
  return parts.join('.')
}
function flipTag(value: string, tagIndex: number): string {
  const parts = value.split('.')
  const tag = Buffer.from(parts[tagIndex], 'base64')
  tag[0] ^= 0xff
  parts[tagIndex] = tag.toString('base64')
  return parts.join('.')
}

describe('AES-GCM authentication tags', () => {
  it('authenticator secrets round-trip and reject truncated or altered tags', () => {
    const cipher = new TotpCipher(randomBytes(32).toString('base64'))
    const sealed = cipher.encrypt('JBSWY3DPEHPK3PXP', 'user-1')
    expect(cipher.decrypt(sealed, 'user-1')).toBe('JBSWY3DPEHPK3PXP')
    expect(() => cipher.decrypt(truncateTag(sealed, 1), 'user-1')).toThrow()
    expect(() => cipher.decrypt(flipTag(sealed, 1), 'user-1')).toThrow()
  })

  it('store receipts round-trip and reject truncated or altered tags', () => {
    const cipher = new StoreReceiptCipher(randomBytes(32))
    const sealed = cipher.encrypt('apple', 'transaction-123')
    expect(cipher.decrypt('apple', sealed)).toBe('transaction-123')
    expect(() => cipher.decrypt('apple', truncateTag(sealed, 2))).toThrow('Invalid encrypted store receipt.')
    expect(() => cipher.decrypt('apple', flipTag(sealed, 2))).toThrow()
  })
})
