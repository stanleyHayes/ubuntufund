import { describe, it, expect } from 'vitest';
import { FlutterwaveGateway } from '../../src/infrastructure/adapters/outbound/payments/FlutterwaveGateway.js';

function gateway(overrides: Partial<{ secretKey: string; webhookHash: string }> = {}) {
  return new FlutterwaveGateway({
    secretKey: overrides.secretKey ?? 'FLWSECK_TEST-x',
    publicKey: 'FLWPUBK_TEST-x',
    webhookHash: overrides.webhookHash ?? 'the-secret-hash',
    publicWebUrl: 'https://give.example.test',
  });
}

const RAW = Buffer.from('{"event":"charge.completed"}');

describe('FlutterwaveGateway', () => {
  it('is disabled without a secret key', () => {
    expect(gateway({ secretKey: '' }).isConfigured()).toBe(false);
    expect(gateway().isConfigured()).toBe(true);
  });

  it('reports diaspora-capable capabilities', () => {
    const caps = gateway().capabilities();
    expect(caps.provider).toBe('flutterwave');
    expect(caps.supportsInternationalCards).toBe(true);
    expect(caps.currencies).toContain('USD');
    expect(caps.methods).toContain('card');
  });

  describe('verifyWebhookSignature (verif-hash, constant-time)', () => {
    it('accepts the exact configured hash', () => {
      expect(gateway().verifyWebhookSignature(RAW, 'the-secret-hash')).toBe(true);
    });

    it('rejects a wrong hash of equal length', () => {
      expect(gateway({ webhookHash: 'abcd' }).verifyWebhookSignature(RAW, 'abce')).toBe(false);
    });

    it('rejects a hash of different length (no throw)', () => {
      expect(gateway().verifyWebhookSignature(RAW, 'short')).toBe(false);
    });

    it('rejects a missing hash, and when unconfigured', () => {
      expect(gateway().verifyWebhookSignature(RAW, undefined)).toBe(false);
      expect(gateway({ secretKey: '' }).verifyWebhookSignature(RAW, 'the-secret-hash')).toBe(false);
      expect(gateway({ webhookHash: '' }).verifyWebhookSignature(RAW, '')).toBe(false);
    });
  });
});
