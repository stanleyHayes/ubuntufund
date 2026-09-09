import { createBrowserSession } from '@ubuntu-fund/ui/src/browserSession'
export const browserSession = createBrowserSession({
  tokensKey: 'uf_admin_tokens', userKey: 'uf_admin_user', accessKey: 'uf_admin_token',
  legacyKeys: ['uf_admin_token'], activityKey: 'uf_admin_last_activity',
  expiredEvent: 'uf:admin-session-expired', changedEvent: 'uf:admin-session-changed',
  refreshUrl: `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`,
})
