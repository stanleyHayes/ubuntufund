import { describe, expect, it } from 'vitest';
import { generateOverlayToken, overlayTokenMatches } from '../../../src/application/utils/overlayToken.js';

describe('overlayTokenMatches', () => {
  const token = generateOverlayToken();

  it('accepts the exact token', () => {
    expect(overlayTokenMatches(token, token)).toBe(true);
    expect(overlayTokenMatches(token, `${token}`.slice(0))).toBe(true);
  });

  it('rejects a wrong token, including one of a different length', () => {
    expect(overlayTokenMatches(token, generateOverlayToken())).toBe(false);
    expect(overlayTokenMatches(token, token.slice(0, -1))).toBe(false);
    expect(overlayTokenMatches(token, `${token}0`)).toBe(false);
    expect(overlayTokenMatches(token, 'x')).toBe(false);
  });

  it('never matches a missing token or a revoked (empty) stored token', () => {
    expect(overlayTokenMatches(token, undefined)).toBe(false);
    expect(overlayTokenMatches(token, '')).toBe(false);
    // A moderation stop writes '' to revoke every overlay link.
    expect(overlayTokenMatches('', '')).toBe(false);
    expect(overlayTokenMatches('', token)).toBe(false);
    expect(overlayTokenMatches(undefined, undefined)).toBe(false);
  });
});
