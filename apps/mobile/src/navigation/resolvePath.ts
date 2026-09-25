/** Translate public web URLs into native routes before Expo Router navigates. */
export function resolveNativePath(input: string): string {
  try {
    const url = new URL(input, 'https://app.ujimora.com')
    let path = url.pathname
    if (url.protocol === 'ujimora:') path = `/${url.hostname}${path}`
    path = path.replace(/^\/--\//, '/').replace(/\/$/, '') || '/'
    const query = url.search
    const parts = path.split('/').filter(Boolean)
    if (parts[0] === 'expo-development-client') return '/'
    if (parts[0] === 'campaigns' && parts[1] === 'new') return '/campaign/create'
    if (parts[0] === 'campaigns' && parts[1] && parts[2] === 'live') return `/campaign/live?id=${encodeURIComponent(parts[1])}`
    if (parts[0] === 'campaigns' && parts[1]) return `/campaign/${parts[1]}${query}`
    if (parts[0] === 'c' && parts[1] && parts[2] === 'live' && parts[3]) return `/live/${parts[3]}`
    if (parts[0] === 'c' && parts[1]) return `/campaign/shared?slug=${encodeURIComponent(parts[1])}${parts[2] === 'donate' ? '&donate=1' : ''}${url.searchParams.has('amount') ? '&amount=' + encodeURIComponent(url.searchParams.get('amount') || '') : ''}`
    if (parts[0] === 'organizations' && parts[1]) return `/organization/${encodeURIComponent(parts[1])}`
    // Early creator QR codes pointed at /u/:userId, which no route handles.
    if (parts[0] === 'u' && parts[1]) return `/profile/${encodeURIComponent(parts[1])}`
    if (path === '/profile') return '/(tabs)/profile'
    if (path === '/subscription' || path === '/subscription/callback' || path === '/subscriptions/callback') return '/(tabs)/subscription'
    if (path === '/campaigns') return '/(tabs)/explore'
    if (parts[0] === 'donations' && parts[1] === 'refund' && parts[2]) return `/refund-request?donationId=${encodeURIComponent(parts[2])}`
    if (path === '/donations') return '/my-donations'
    if (path === '/refunds') return '/my-refunds'
    // Keep ?ref= (referral) and ?returnTo= on the auth screens; they validate both.
    if (path === '/login') return `/(auth)/login${query}`
    if (path === '/register') return `/(auth)/register${query}`
    // Referral links point at the site root (app.ujimora.com/?ref=CODE); '/' would
    // otherwise redirect straight to the tabs and drop the code.
    if (path === '/' && url.searchParams.get('ref')) return `/(auth)/register?ref=${encodeURIComponent(url.searchParams.get('ref') || '')}`
    return path + query
  } catch { return '/+not-found' }
}
