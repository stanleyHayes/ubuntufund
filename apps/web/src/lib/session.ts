import { createBrowserSession } from '@ubuntu-fund/ui/src/browserSession'
export const SESSION_EXPIRED = 'uf:session-expired'
// uf_tokens is the only place the access token lives. No `accessKey`: renewals
// used to mirror the token into the legacy 'accessToken' key, but sign-in and
// replaceTokens (password change, MFA enrollment) never updated it, so it could
// keep a revoked token that callers then sent. 'accessToken' stays in
// legacyKeys so sign-out still removes copies left by older builds.
export const browserSession = createBrowserSession({
  tokensKey: 'uf_tokens', userKey: 'uf_user',
  legacyKeys: ['accessToken', 'refreshToken'], activityKey: 'uf_last_activity',
  expiredEvent: SESSION_EXPIRED, changedEvent: 'uf:session-changed',
  refreshUrl: `${import.meta.env?.VITE_API_URL || '/api/v1'}/auth/refresh`,
})
export const storedAccessToken = browserSession.accessToken
export const tokenExpiresAt = browserSession.expiresAt
export const expireSession = (token: string) => browserSession.expire(token)
export const forceExpireSession = () => browserSession.expire()
