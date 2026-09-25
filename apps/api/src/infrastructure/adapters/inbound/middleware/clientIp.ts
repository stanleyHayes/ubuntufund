import { isIP } from 'node:net';
import type { Request } from 'express';

/**
 * The address of the client that made this request, for rate limiting and the
 * audit trail.
 *
 * Every public route to this API — api.ujimora.com and *.onrender.com — enters
 * through Render's Cloudflare edge, which OVERWRITES `CF-Connecting-IP` with
 * the address that connected to it. A value a client sends is therefore
 * replaced before it reaches us, so it is safe to key on.
 *
 * `X-Forwarded-For` is deliberately ignored, and `trust proxy` stays unset:
 * Cloudflare and Render append to a client-supplied X-Forwarded-For rather
 * than resetting it, so its leftmost entry is attacker-controlled, and no fixed
 * hop count is right for both the direct path (mobile, OBS, browsers calling
 * the API origin) and the legacy Vercel `/api/v1` rewrite. Without trust
 * proxy, `req.ip` is the socket peer: Render's internal proxy in production,
 * the real peer in development and tests.
 *
 * Browsers still reaching the API through the Vercel rewrite are seen as
 * Vercel's egress address — the web and admin builds call the API origin
 * directly for exactly that reason.
 */
export function clientIp(req: Request): string {
  const edge = req.get('cf-connecting-ip')?.trim();
  if (edge && isIP(edge)) return unmapIpv4(edge);
  const peer = req.ip ?? req.socket?.remoteAddress;
  return peer ? unmapIpv4(peer) : 'unknown';
}

/**
 * The rate-limit identity for a request: the client IP, with IPv6 collapsed to
 * its /64. One subscriber (a phone, a home router) is routinely handed a whole
 * /64, so keying on the full 128-bit address would let one client rotate
 * through billions of fresh buckets.
 */
export function rateLimitClientKey(req: Request): string {
  const ip = clientIp(req);
  return isIP(ip) === 6 ? ipv6Prefix64(ip) : ip;
}

/** `::ffff:203.0.113.9` (an IPv4 client on a dual-stack socket) → `203.0.113.9`. */
function unmapIpv4(ip: string): string {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  return mapped && isIP(mapped[1]) === 4 ? mapped[1] : ip;
}

/** First four hextets of a valid IPv6 address, e.g. `2001:db8:0:1::/64`. */
export function ipv6Prefix64(ip: string): string {
  let address = ip.split('%')[0].toLowerCase(); // drop any zone id (fe80::1%eth0)
  // A trailing dotted quad (::ffff:1.2.3.4, 64:ff9b::1.2.3.4) is two hextets.
  const quad = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (quad) {
    const [a, b, c, d] = quad.slice(1).map(Number);
    address = `${address.slice(0, quad.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const compressed = address.indexOf('::');
  let groups: string[];
  if (compressed === -1) {
    groups = address.split(':');
  } else {
    const head = address.slice(0, compressed).split(':').filter(Boolean);
    const tail = address.slice(compressed + 2).split(':').filter(Boolean);
    groups = [...head, ...Array<string>(8 - head.length - tail.length).fill('0'), ...tail];
  }
  return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(':')}::/64`;
}
