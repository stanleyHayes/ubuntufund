const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { expireSession, storedAccessToken, tokenExpiresAt, SESSION_EXPIRED } = require('../src/lib/session')
const { api, request } = require('../src/lib/api')
let events = 0
beforeEach(() => {
  const data = new Map()
  global.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  global.window = new EventTarget()
  events = 0
  window.addEventListener(SESSION_EXPIRED, () => events++)
})
function session(token) { localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: token })); localStorage.setItem('uf_user', '{"name":"Member"}') }

test('both authenticated API paths invalidate a rejected session once', async () => {
  for (const call of [() => api.get('/wallets'), () => request('/profile', { token: 'expired' })]) {
    session('expired')
    global.fetch = async () => new Response('{"error":"Invalid token"}', { status: 401 })
    await assert.rejects(call)
    assert.equal(storedAccessToken(), null)
    assert.equal(localStorage.getItem('uf_user'), null)
  }
  assert.equal(events, 2)
  expireSession('expired')
  assert.equal(events, 2)
})
test('stale requests and forbidden responses cannot log out a valid newer session', async () => {
  session('new')
  expireSession('old')
  global.fetch = async () => new Response('{"error":"Forbidden"}', { status: 403 })
  await assert.rejects(() => api.get('/wallets'))
  assert.equal(storedAccessToken(), 'new')
  assert.equal(events, 0)
})
test('unauthenticated login failures do not expire a stored session', async () => {
  session('current')
  global.fetch = async () => new Response('{}', { status: 401 })
  await assert.rejects(() => request('/auth/login', { method: 'POST' }))
  assert.equal(events, 0)
})
test('canonical tokens win over legacy tokens; expiry is read safely', () => {
  session('current'); localStorage.setItem('accessToken', 'legacy')
  assert.equal(storedAccessToken(), 'current')
  const encoded = Buffer.from(JSON.stringify({ exp: 1234 })).toString('base64url')
  assert.equal(tokenExpiresAt(`header.${encoded}.signature`), 1234000)
  assert.equal(tokenExpiresAt('invalid'), null)
  expireSession('current')
  assert.equal(localStorage.getItem('accessToken'), null)
})
