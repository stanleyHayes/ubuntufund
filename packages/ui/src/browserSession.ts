/** Shared browser-session lifecycle for the member and admin applications. */
export function createBrowserSession(options: {
  tokensKey: string
  userKey: string
  legacyKeys: string[]
  accessKey?: string
  activityKey: string
  expiredEvent: string
  changedEvent: string
  refreshUrl: string
}) {
  const idleMs = 60 * 60 * 1000
  let refresh: Promise<string | null> | null = null
  // Storage can be missing or throw (site data blocked → SecurityError; some
  // in-app WebViews run with DOM storage off). Without it the session simply
  // reads as signed out — it must never throw into React and blank the app.
  function read(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  }
  function write(key: string, value: string) {
    try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
  }
  function remove(key: string) {
    try { localStorage.removeItem(key) } catch { /* storage unavailable */ }
  }
  function tokens(): { accessToken: string; refreshToken?: string } | null {
    try { return JSON.parse(read(options.tokensKey) ?? 'null') } catch { return null }
  }
  function accessToken(): string | null {
    return tokens()?.accessToken ?? (options.accessKey ? read(options.accessKey) : null)
  }
  function claims(token: string): { exp?: unknown; iat?: unknown } | null {
    try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) } catch { return null }
  }
  function expiresAt(token: string): number | null {
    const payload = claims(token)
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : null
  }
  // When this browser first saw each access token, so expiry can be measured
  // from local receipt plus the token's own lifetime (exp - iat) instead of
  // comparing server time with a device clock that may be minutes off.
  const receivedKey = `${options.tokensKey}:received`
  function localExpiresAt(token: string): number | null {
    const payload = claims(token)
    if (typeof payload?.exp !== 'number') return null
    if (typeof payload.iat !== 'number' || payload.exp <= payload.iat) return payload.exp * 1000
    const tag = token.slice(-24)
    let receivedAt: number | null = null
    try {
      const saved = JSON.parse(read(receivedKey) ?? 'null') as { tag?: string; at?: number } | null
      if (saved?.tag === tag && typeof saved.at === 'number' && Number.isFinite(saved.at)) receivedAt = saved.at
    } catch { /* Recorded again below. */ }
    if (receivedAt === null) {
      receivedAt = Date.now()
      write(receivedKey, JSON.stringify({ tag, at: receivedAt }))
    }
    return receivedAt + (payload.exp - payload.iat) * 1000
  }
  function clear() {
    for (const key of [options.tokensKey, options.userKey, options.activityKey, receivedKey, ...options.legacyKeys]) remove(key)
  }
  function expire(rejectedToken?: string) {
    if (rejectedToken !== undefined && accessToken() !== rejectedToken) return
    clear()
    window.dispatchEvent(new Event(options.expiredEvent))
  }
  /**
   * Best-effort server-side sign-out of this session (POST /auth/logout with the
   * refresh token), so a copied refresh token stops working. Never blocks or
   * fails the local sign-out; call it before clear().
   */
  function revokeOnServer() {
    const refreshToken = tokens()?.refreshToken
    if (!refreshToken) return
    try {
      void fetch(options.refreshUrl.replace(/\/refresh$/, '/logout'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }), keepalive: true,
      }).catch(() => {})
    } catch { /* Offline or blocked: the local sign-out still completes. */ }
  }
  function resetActivity() { write(options.activityKey, String(Date.now())) }
  function isIdle() {
    const raw = read(options.activityKey)
    if (!raw) { resetActivity(); return false } // Existing sessions migrate once.
    const last = Number(raw)
    return !Number.isFinite(last) || Date.now() - last >= idleMs
  }
  async function ensureAccessToken(): Promise<string | null> {
    const current = accessToken()
    if (!current) return null
    if (isIdle()) { expire(current); return null }
    const expiry = localExpiresAt(current)
    if (expiry === null || expiry > Date.now() + 60000) return current
    const stored = tokens()
    if (!stored?.refreshToken) { if (expiry <= Date.now()) { expire(current); return null } return current }
    return renew(current, stored.refreshToken)
  }
  /**
   * The API rejected `rejectedToken` with 401 although it looked valid here
   * (for example the device clock is behind). Renew once, whatever the local
   * clock says. Resolves to the new token; null when the session has ended
   * (the refresh itself was refused or there is no refresh token); rejects on
   * a network failure without signing the user out.
   */
  async function forceRefresh(rejectedToken: string): Promise<string | null> {
    const current = accessToken()
    if (!current) return null
    if (current !== rejectedToken) return current // Another request already renewed it.
    if (isIdle()) { expire(current); return null }
    const stored = tokens()
    if (!stored?.refreshToken) { expire(current); return null }
    return renew(current, stored.refreshToken)
  }
  function renew(current: string, refreshToken: string): Promise<string | null> {
    if (refresh) return refresh
    refresh = (async () => {
      const response = await fetch(options.refreshUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }), signal: AbortSignal.timeout(15000),
      })
      // A late refresh cannot resurrect a logged-out session or overwrite a newer login.
      if (accessToken() !== current) return accessToken()
      if (isIdle()) { expire(current); return null }
      if (response.status === 401 || response.status === 403) { expire(current); return null }
      if (!response.ok) throw new Error('Unable to renew your session. Please try again.')
      const { data } = await response.json()
      if (!data?.accessToken || !data?.refreshToken) throw new Error('Unable to renew your session. Please try again.')
      if (accessToken() !== current) return accessToken()
      write(options.tokensKey, JSON.stringify(data))
      if (options.accessKey) write(options.accessKey, data.accessToken)
      window.dispatchEvent(new Event(options.changedEvent))
      return data.accessToken as string
    })().finally(() => { refresh = null })
    return refresh
  }
  function start(onChange: () => void) {
    const check = () => {
      if (!accessToken()) return
      if (isIdle()) { expire(); return }
      // Connectivity failures do not log out a valid session; subsequent requests retry.
      void ensureAccessToken().catch(() => {})
    }
    const activity = () => {
      if (!accessToken()) return
      if (isIdle()) { expire(); return }
      const last = Number(read(options.activityKey) ?? 0)
      if (Date.now() - last >= 1000) resetActivity()
      check()
    }
    const storage = (event: StorageEvent) => {
      if ([options.tokensKey, options.userKey, options.activityKey, null].includes(event.key)) { onChange(); check() }
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart']
    for (const event of events) window.addEventListener(event, activity, { passive: true })
    window.addEventListener('focus', check)
    window.addEventListener('storage', storage)
    window.addEventListener(options.changedEvent, onChange)
    window.addEventListener(options.expiredEvent, onChange)
    const timer = window.setInterval(check, 15000)
    check()
    return () => {
      window.clearInterval(timer)
      for (const event of events) window.removeEventListener(event, activity)
      window.removeEventListener('focus', check)
      window.removeEventListener('storage', storage)
      window.removeEventListener(options.changedEvent, onChange)
      window.removeEventListener(options.expiredEvent, onChange)
    }
  }
  return { accessToken, expiresAt, expire, clear, revokeOnServer, resetActivity, ensureAccessToken, forceRefresh, start }
}
