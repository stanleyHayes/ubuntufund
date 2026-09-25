import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  clientIp,
  ipv6Prefix64,
  rateLimitClientKey,
} from '../../src/infrastructure/adapters/inbound/middleware/clientIp.js';
import { isLiveReadRequest } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js';

function fakeRequest(headers: Record<string, string>, ip?: string, extra: Partial<Request> = {}): Request {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ip,
    socket: { remoteAddress: ip },
    get: (name: string) => lower[name.toLowerCase()],
    ...extra,
  } as unknown as Request;
}

describe('clientIp', () => {
  it('prefers the Cloudflare edge address over the socket peer', () => {
    expect(clientIp(fakeRequest({ 'CF-Connecting-IP': '198.51.100.7' }, '10.0.0.5'))).toBe('198.51.100.7');
  });

  it('never trusts X-Forwarded-For, X-Real-IP or X-Vercel-Forwarded-For', () => {
    const req = fakeRequest(
      { 'X-Forwarded-For': '203.0.113.9', 'X-Real-IP': '203.0.113.9', 'X-Vercel-Forwarded-For': '203.0.113.9' },
      '10.0.0.5',
    );
    expect(clientIp(req)).toBe('10.0.0.5');
  });

  it('ignores a CF-Connecting-IP that is not an IP address', () => {
    expect(clientIp(fakeRequest({ 'CF-Connecting-IP': 'evil, 1.2.3.4' }, '10.0.0.5'))).toBe('10.0.0.5');
    expect(clientIp(fakeRequest({ 'CF-Connecting-IP': '' }, '10.0.0.5'))).toBe('10.0.0.5');
  });

  it('unwraps IPv4-mapped IPv6 addresses', () => {
    expect(clientIp(fakeRequest({}, '::ffff:127.0.0.1'))).toBe('127.0.0.1');
    expect(clientIp(fakeRequest({ 'CF-Connecting-IP': '::ffff:198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('falls back to "unknown" with no address at all', () => {
    expect(clientIp(fakeRequest({}))).toBe('unknown');
  });
});

describe('rateLimitClientKey', () => {
  it('keys IPv4 clients on the full address', () => {
    expect(rateLimitClientKey(fakeRequest({ 'CF-Connecting-IP': '198.51.100.7' }))).toBe('198.51.100.7');
  });

  it('collapses IPv6 clients to their /64', () => {
    const a = rateLimitClientKey(fakeRequest({ 'CF-Connecting-IP': '2001:db8:abcd:12:1111:2222:3333:4444' }));
    const b = rateLimitClientKey(fakeRequest({ 'CF-Connecting-IP': '2001:0db8:abcd:0012::9' }));
    const other = rateLimitClientKey(fakeRequest({ 'CF-Connecting-IP': '2001:db8:abcd:13::1' }));
    expect(a).toBe('2001:db8:abcd:12::/64');
    expect(b).toBe(a);
    expect(other).not.toBe(a);
  });
});

describe('ipv6Prefix64', () => {
  it.each([
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['2001:db8::', '2001:db8:0:0::/64'],
    ['64:ff9b::198.51.100.7', '64:ff9b:0:0::/64'],
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1:2::/64'],
  ])('%s → %s', (input, expected) => {
    expect(ipv6Prefix64(input)).toBe(expected);
  });
});

describe('isLiveReadRequest', () => {
  const at = (method: string, path: string) => fakeRequest({}, undefined, { method, path });

  it.each([
    '/live-sessions/abc/public',
    '/live-sessions/abc/overlay',
    '/live-sessions/abc/overlay/view',
    '/live-sessions/abc/events',
    '/live-sessions/video/config',
    '/campaigns/abc/events',
    '/campaigns/abc/active-live',
    '/campaigns/abc/live-sessions/active',
  ])('treats GET %s as a live read', (path) => {
    expect(isLiveReadRequest(at('GET', path))).toBe(true);
  });

  it.each([
    ['POST', '/live-sessions/abc/video/viewer-token'],
    ['POST', '/campaigns/abc/live-sessions'],
    ['PATCH', '/live-sessions/abc'],
    ['POST', '/live-sessions/abc/public'],
    ['GET', '/campaigns/abc'],
    ['GET', '/campaigns/abc/donations'],
    ['GET', '/donation-intents/abc'],
  ])('keeps %s %s on the general limiter', (method, path) => {
    expect(isLiveReadRequest(at(method, path))).toBe(false);
  });
});
