/** Restrict creation of public content; never gate reading, erasure or access to funds. */
export function requiresContentAcceptance(method: string, originalUrl: string, body?: Record<string, unknown>): boolean {
  if (!['POST', 'PUT', 'PATCH'].includes(method)) return false;
  // Express routes are case-insensitive by default; policy matching must be too.
  const path = originalUrl.split('?')[0].replace(/^\/api\/v1/i, '').replace(/\/+$/, '').toLowerCase();
  if (path === '/uploads/image' && new URL(originalUrl, 'https://local.invalid').searchParams.get('folder')?.toLowerCase() === 'kyc') return false;
  if (typeof body?.message === 'string' && body.message.trim() && (path === '/donation-intents' || /^\/campaigns\/[^/]+\/donate$/.test(path) || /^\/creators\/[^/]+\/tips$/.test(path) || /^\/campaigns\/[^/]+\/donations\/crypto$/.test(path))) return true;
  if (path === '/creators/profile' && body?.tipsEnabled === false && Object.keys(body).every(key => key === 'tipsEnabled')) return false;
  if (path === '/profile') return ['name', 'country', 'avatarUrl', 'coverUrl'].some(key => !!body?.[key]) || body?.publicProfile === true;
  return /^\/campaigns\/[^/]+$/.test(path) || path === '/campaigns' || path === '/creators/profile' || path.startsWith('/uploads') ||
    /^\/organization-team\/[^/]+\/(profile|campaigns\/[^/]+\/updates)$/.test(path) ||
    /^\/campaigns\/[^/]+\/(comments|updates|slug|live-sessions)(\/|$)/.test(path) ||
    /^\/live-sessions\/[^/]+\/video\/host-token$/.test(path) ||
    /^\/donations\/[^/]+\/message$/.test(path);
}
