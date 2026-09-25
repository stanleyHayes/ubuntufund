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
  function expiresAt(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null
    } catch { return null }
  }
  function clear() {
    for (const key of [options.tokensKey, options.userKey, options.activityKey, ...options.legacyKeys]) remove(key)
  }
  function expire(rejectedToken?: string) {
    if (rejectedToken !== undefined && accessToken() !== rejectedToken) return
    clear()
    window.dispatchEvent(new Event(options.expiredEvent))
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
    const expiry = expiresAt(current)
    if (expiry === null || expiry > Date.now() + 60000) return current
    const stored = tokens()
    if (!stored?.refreshToken) { if (expiry <= Date.now()) { expire(current); return null } return current }
    if (refresh) return refresh
    refresh = (async () => {
      const response = await fetch(options.refreshUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken }), signal: AbortSignal.timeout(15000),
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
  return { accessToken, expiresAt, expire, clear, resetActivity, ensureAccessToken, start }
}
