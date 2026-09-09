import { createBrowserSession } from '@ubuntu-fund/ui/src/browserSession'
export const SESSION_EXPIRED = 'uf:session-expired'
export const browserSession = createBrowserSession({
  tokensKey: 'uf_tokens', userKey: 'uf_user', accessKey: 'accessToken',
  legacyKeys: ['accessToken', 'refreshToken'], activityKey: 'uf_last_activity',
  expiredEvent: SESSION_EXPIRED, changedEvent: 'uf:session-changed',
  refreshUrl: `${import.meta.env?.VITE_API_URL || '/api/v1'}/auth/refresh`,
})
export const storedAccessToken = browserSession.accessToken
export const tokenExpiresAt = browserSession.expiresAt
export const expireSession = (token: string) => browserSession.expire(token)
export const forceExpireSession = () => browserSession.expire()
