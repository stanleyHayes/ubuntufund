import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ data: new Map<string, string>(), get: vi.fn(), set: vi.fn(), hardware: vi.fn(), enrolled: vi.fn(), prompt: vi.fn(), capable: vi.fn() }))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => m.data.get(key) ?? null,
  removeItem: async (key: string) => { m.data.delete(key) },
  multiSet: async (rows: [string, string][]) => { rows.forEach(([key, value]) => m.data.set(key, value)) },
  multiRemove: async (keys: string[]) => { keys.forEach(key => m.data.delete(key)) },
} }))
vi.mock('expo-secure-store', () => ({ getItemAsync: m.get, setItemAsync: m.set, deleteItemAsync: async (key: string) => { m.data.delete(`secure:${key}`) }, WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device', canUseBiometricAuthentication: m.capable }))
vi.mock('expo-local-authentication', () => ({ hasHardwareAsync: m.hardware, isEnrolledAsync: m.enrolled, supportedAuthenticationTypesAsync: async () => [2], AuthenticationType: { FACIAL_RECOGNITION: 2 }, authenticateAsync: m.prompt }))
const user = { id: 'member', name: 'Ama', email: 'ama@example.test', role: 'user' }
const valid = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 7200 }))}.sig`
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); m.data.clear()
  m.hardware.mockResolvedValue(true); m.enrolled.mockResolvedValue(true); m.capable.mockReturnValue(true); m.prompt.mockResolvedValue({ success: true })
  m.get.mockImplementation(async (key: string) => m.data.get(`secure:${key}`) ?? null)
  m.set.mockImplementation(async (key: string, value: string) => { m.data.set(`secure:${key}`, value) })
})
async function setup() {
  const s = await import('../session')
  const renew = vi.fn(async () => ({ accessToken: valid, refreshToken: 'renewed' }))
  s.configureRefresh(renew)
  await s.establishSession(user, { accessToken: valid, refreshToken: 'original-refresh' })
  return { s, renew }
}
it('requires supported enrolled hardware and explicit initial confirmation before moving the saved credential', async () => {
  const { s } = await setup()
  m.hardware.mockResolvedValue(false)
  await expect(s.enableBiometricSession()).rejects.toThrow('not enrolled')
  expect(m.prompt).not.toHaveBeenCalled()
  m.hardware.mockResolvedValue(true); m.prompt.mockResolvedValueOnce({ success: false })
  await expect(s.enableBiometricSession()).rejects.toThrow('cancelled')
  expect(s.biometricSessionState()).toEqual({ enabled: false, locked: false })
  expect(m.data.has('secure:uf_tokens')).toBe(true)
  await s.enableBiometricSession()
  expect(s.biometricSessionState()).toEqual({ enabled: true, locked: false })
  expect(m.set).toHaveBeenCalledWith('uf_biometric_refresh', JSON.stringify({ userId: 'member', refreshToken: 'original-refresh' }), expect.objectContaining({ requireAuthentication: true, keychainAccessible: 'device', keychainService: 'ujimora.biometric-session' }))
  expect(m.prompt).toHaveBeenLastCalledWith(expect.objectContaining({ disableDeviceFallback: true, biometricsSecurityLevel: 'strong' }))
  expect(m.data.has('secure:uf_tokens')).toBe(false)
  expect(m.data.has('uf_tokens')).toBe(false)
})
it('locks on background, prevents credential access and requires a protected read plus server refresh to unlock', async () => {
  const { s, renew } = await setup(); await s.enableBiometricSession()
  s.setSessionForeground(false)
  expect(s.sessionSnapshot()).toBeNull()
  expect(await s.accessToken()).toBeNull()
  expect(renew).not.toHaveBeenCalled()
  s.setSessionForeground(true)
  await s.unlockBiometricSession()
  expect(m.get).toHaveBeenCalledWith('uf_biometric_refresh', expect.objectContaining({ requireAuthentication: true }))
  expect(renew).toHaveBeenCalledWith('original-refresh')
  expect(s.sessionSnapshot()?.user.id).toBe('member')
  expect(s.biometricSessionState()).toEqual({ enabled: true, locked: false })
  expect(m.data.has('secure:uf_tokens')).toBe(false)
  // Ordinary refreshes never replace the protected vault with an unprotected copy.
  const writes = m.set.mock.calls.filter(call => call[0] === 'uf_biometric_refresh').length
  await s.accessToken(true)
  expect(m.set.mock.calls.filter(call => call[0] === 'uf_biometric_refresh')).toHaveLength(writes)
})
it('stays locked on cancellation, enrollment changes and revoked server sessions; password fallback clears the vault', async () => {
  const { s, renew } = await setup(); await s.enableBiometricSession(); s.lockBiometricSession()
  m.get.mockRejectedValueOnce(new Error('cancelled'))
  await expect(s.unlockBiometricSession()).rejects.toThrow('cancelled')
  expect(s.sessionSnapshot()).toBeNull()
  m.get.mockResolvedValueOnce(null)
  await expect(s.unlockBiometricSession()).rejects.toThrow('changed or expired')
  renew.mockRejectedValueOnce(Object.assign(new Error('revoked'), { status: 401 }))
  await expect(s.unlockBiometricSession()).rejects.toThrow('revoked')
  expect(s.biometricSessionState().locked).toBe(true)
  await s.endSession()
  expect(m.data.has('secure:uf_biometric_refresh')).toBe(false)
  expect(m.data.has('secure:uf_biometric_user')).toBe(false)
  await s.establishSession({ ...user, id: 'other' }, { accessToken: valid, refreshToken: 'other-refresh' })
  expect(s.biometricSessionState()).toEqual({ enabled: false, locked: false })
})
it('cold start does not read either protected or leftover ordinary credentials until explicit unlock', async () => {
  const { s } = await setup(); await s.enableBiometricSession()
  m.data.set('secure:uf_tokens', JSON.stringify({ accessToken: valid, refreshToken: 'stale-plain' }))
  vi.resetModules(); m.get.mockClear()
  const restarted = await import('../session')
  restarted.configureRefresh(async () => ({ accessToken: valid, refreshToken: 'renewed' }))
  await restarted.hydrateSession()
  expect(restarted.biometricSessionState().locked).toBe(true)
  expect(restarted.sessionSnapshot()).toBeNull()
  expect(m.get.mock.calls.map(call => call[0])).toEqual(['uf_biometric_user'])
  expect(m.data.has('secure:uf_tokens')).toBe(false)
  await restarted.unlockBiometricSession()
  expect(restarted.sessionSnapshot()?.user.id).toBe(user.id)
})
it('does not restore the account after logout while an unlock prompt is pending', async () => {
  const { s, renew } = await setup(); await s.enableBiometricSession(); s.lockBiometricSession()
  let resolve!: (value: string) => void
  m.get.mockImplementationOnce(() => new Promise<string>(done => { resolve = done }))
  const unlocking = s.unlockBiometricSession()
  await vi.waitFor(() => expect(resolve).toBeDefined())
  await s.endSession()
  resolve(JSON.stringify({ userId: user.id, refreshToken: 'original-refresh' }))
  await unlocking
  expect(s.sessionSnapshot()).toBeNull()
  expect(renew).not.toHaveBeenCalled()
})
it('fences an earlier network refresh after locking and serializes simultaneous unlock requests', async () => {
  const { s } = await setup(); await s.enableBiometricSession()
  let resolve!: (value: { accessToken: string; refreshToken: string }) => void
  const renew = vi.fn(() => new Promise<{ accessToken: string; refreshToken: string }>(done => { resolve = done }))
  s.configureRefresh(renew)
  const refreshing = s.accessToken(true)
  await vi.waitFor(() => expect(resolve).toBeDefined())
  s.lockBiometricSession(); resolve({ accessToken: valid, refreshToken: 'late' })
  expect(await refreshing).toBeNull()
  const first = s.unlockBiometricSession(), second = s.unlockBiometricSession()
  await vi.waitFor(() => expect(renew).toHaveBeenCalledTimes(2))
  resolve({ accessToken: valid, refreshToken: 'fresh' }); await Promise.all([first, second])
  expect(s.sessionSnapshot()?.tokens.refreshToken).toBe('fresh')
})
it('authenticates disabling and keeps protection when the prompt is cancelled', async () => {
  const { s } = await setup(); await s.enableBiometricSession()
  m.get.mockRejectedValueOnce(new Error('cancelled'))
  await expect(s.disableBiometricSession()).rejects.toThrow('cancelled')
  expect(s.biometricSessionState().enabled).toBe(true)
  await s.disableBiometricSession()
  expect(s.biometricSessionState().enabled).toBe(false)
  expect(m.data.has('secure:uf_biometric_refresh')).toBe(false)
  expect(m.data.has('secure:uf_tokens')).toBe(true)
})
it('keeps rotated MFA/password credentials protected and does not reveal private screens during the OS prompt', async () => {
  const { s } = await setup(); await s.enableBiometricSession()
  m.set.mockImplementationOnce(async (key: string, value: string) => {
    s.setSessionForeground(false)
    expect(s.biometricSessionState().locked).toBe(false) // UI privacy cover hides mounted form during system prompt.
    m.data.set(`secure:${key}`, value); s.setSessionForeground(true)
  })
  await s.establishSession(user, { accessToken: valid, refreshToken: 'new-credential-version' })
  expect(JSON.parse(m.data.get('secure:uf_biometric_refresh')!).refreshToken).toBe('new-credential-version')
  expect(m.data.has('secure:uf_tokens')).toBe(false)
  s.lockBiometricSession()
  expect(s.sessionSnapshot()).toBeNull()
})

it('cancels an unlock if the app enters the background during its network check', async () => {
  const { s } = await setup(); await s.enableBiometricSession(); s.lockBiometricSession()
  let resolve!: (value: { accessToken: string; refreshToken: string }) => void
  s.configureRefresh(() => new Promise(done => { resolve = done }))
  const unlocking = s.unlockBiometricSession()
  await vi.waitFor(() => expect(resolve).toBeDefined())
  s.setSessionForeground(false, true); s.setSessionForeground(true)
  resolve({ accessToken: valid, refreshToken: 'late-unlock' })
  await unlocking
  expect(s.sessionSnapshot()).toBeNull()
  expect(s.biometricSessionState().locked).toBe(true)
});

it('times out a stalled server unlock without accepting a late response', async () => {
  const { s } = await setup(); await s.enableBiometricSession(); s.lockBiometricSession()
  let resolve!: (value: { accessToken: string; refreshToken: string }) => void
  s.configureRefresh(() => new Promise(done => { resolve = done }))
  vi.useFakeTimers()
  try {
    const unlocking = s.unlockBiometricSession()
    const rejected = expect(unlocking).rejects.toThrow('could not reach')
    await vi.advanceTimersByTimeAsync(15_001)
    await rejected
    resolve({ accessToken: valid, refreshToken: 'late-timeout' })
    await Promise.resolve()
    expect(s.sessionSnapshot()).toBeNull()
    expect(s.biometricSessionState().locked).toBe(true)
  } finally { vi.useRealTimers() }
});

it('locks an idle opted-in session while preserving its protected credential for reauthentication', async () => {
  const { s } = await setup(); await s.enableBiometricSession()
  vi.useFakeTimers()
  try {
    vi.setSystemTime(Date.now() + s.IDLE_MS + 1)
    s.recordActivity()
    expect(s.sessionSnapshot()).toBeNull()
    expect(s.biometricSessionState().locked).toBe(true)
    expect(m.data.has('secure:uf_biometric_refresh')).toBe(true)
    await s.unlockBiometricSession()
    expect(s.sessionSnapshot()?.user.id).toBe(user.id)
  } finally { vi.useRealTimers() }
});
